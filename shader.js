'use strict';
/** @type {HTMLButtonElement} */
const compileButton = document.getElementById("bcompile");
/** @type {HTMLTextAreaElement} */
const fragSource = document.getElementById('fragsrc');
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("glcanv");
/** @type {HTMLSpanElement} */
const compileStatus = document.getElementById("glstatus");
/** @type {WebGL2RenderingContext} */
let gl = canvas.getContext('webgl2');
/** @type {HTMLInputElement} */
let cxe = document.getElementById('customx');
/** @type {HTMLInputElement} */
let cye = document.getElementById('customy');
/** @type {HTMLInputElement} */
let cze = document.getElementById('customz');
/** @type {HTMLInputElement} */
let cwe = document.getElementById('customw');
/** @type {HTMLImageElement} */
let imge = document.getElementById('glimg');
/** @type {HTMLImageElement} */
let lightimg = document.getElementById('lightimg');
/** @type {HTMLInputElement} */
let toggleAbsoluteViewport = document.getElementById('usepxviewport');

const vertexSource = `#version 300 es

in vec2 a_position;
in vec2 a_texcoord;

out vec2 texcoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    texcoord = a_texcoord;
}
`;

/** @type {WebGLShader} */
let vertexShader = null;
/** @type {WebGLProgram} */
let shaderProgram = null;
/** @type {WebGLBuffer} */
let positionBuffer = null;
/** @type {WebGLBuffer} */
let texcoordBuffer = null;
/** @type {WebGLBuffer} */
let indexBuffer = null;

const attributeLoc = {
    /** @property {GLuint>} */
    position: null,
    /** @property {GLuint>} */
    texcoord: null
}

const uniform = {
    /** @property {GLuint>} */
    viewportSize: null,
    /** @property {GLuint>} */
    userParam: null,
    // cursor: null,
    /** @property {GLuint>} */
    time: null,
};

/** @type {GLuint} */
let userTexture = null;
/** @type {GLuint} */
let lightTexture = null;

let useAbsoluteViewport = false;
let customX = 0;
let customY = 0;
let customZ = 0;
let customW = 1;

let compileTime = Date.now();

const vertices = new Float32Array([
    -1.0, 1.0,  // top left
    1.0, 1.0,   // top right
    -1.0, -1.0, // bottom left
    1.0, -1.0   // bottom right
]);

const coords = new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    1.0, 1.0
]);

const indices = new Uint16Array([
    0, 1, 2,
    1, 2, 3
]);

requestAnimationFrame = requestAnimationFrame || webkitRequestAnimationFrame;

function updateShaders() {
    /** @type {WebGLProgram} */
    let p = gl.createProgram();
    /** @type {WebGLShader} */
    let fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragSource.value);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        let e = new Error(gl.getShaderInfoLog(fs));
        gl.deleteShader(fs);
        gl.deleteProgram(p);
        compileStatus.className = 'bad';
        compileStatus.innerText = 'Compile Failed';
        throw e;
    };
    gl.attachShader(p, vertexShader);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        let e = new Error(gl.getProgramInfoLog(p));
        gl.detachShader(p, fs);
        gl.detachShader(p, vertexShader);
        gl.deleteShader(fs);
        gl.deleteProgram(p);
        compileStatus.className = 'bad';
        compileStatus.innerText = 'Linking Failed';
        throw e;
    };
    gl.detachShader(p, fs);
    gl.deleteShader(fs);
    compileStatus.className = 'good';
    compileStatus.innerText = 'Compiled';
    gl.deleteProgram(shaderProgram);
    shaderProgram = p;
    // attributes
    attributeLoc.position = gl.getAttribLocation(shaderProgram, 'a_position');
    attributeLoc.texcoord = gl.getAttribLocation(shaderProgram, 'a_texcoord');
    // uniforms
    uniform.userParam = gl.getUniformLocation(shaderProgram, 'userParam');
    uniform.viewportSize = gl.getUniformLocation(shaderProgram, 'viewportSize');
    uniform.time = gl.getUniformLocation(shaderProgram, 'time');
    compileTime = Date.now();
}

function main() {
    vertexShader = gl.createShader(gl.VERTEX_SHADER);

    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        let e = new Error(gl.getShaderInfoLog(vertexShader));
        gl.deleteShader(vertexShader);
        gl.deleteProgram(shaderProgram);
        throw e;
    };

    updateShaders();

    positionBuffer = gl.createBuffer();
    texcoordBuffer = gl.createBuffer();
    indexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(attributeLoc.position);
    gl.vertexAttribPointer(
        attributeLoc.position,
        2, // 2 values per vertex shader iteration
        gl.FLOAT, // data is 32bit floats
        false,        // don't normalize
        0,            // stride (0 = auto)
        0,            // offset into buffer
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.enableVertexAttribArray(attributeLoc.texcoord);
    gl.vertexAttribPointer(
        attributeLoc.texcoord,
        2,
        gl.FLOAT,
        false, // normalize
        0,     // stride (0 = auto)
        0,     // offset into buffer
    );


    userTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, userTexture);
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    // const pixel = new Uint8Array([0, 0, 255, 255]); // opaque blue
    gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        imge.width,
        imge.height,
        border,
        srcFormat,
        srcType,
        imge
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    lightTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lightTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        lightimg.width,
        lightimg.height,
        border,
        srcFormat,
        srcType,
        lightimg
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);


    requestAnimationFrame(tick);

    compileButton.addEventListener('click', () => {
        updateShaders();
    });
}

function tick() {
    // gl.clearColor(0.125, 0.25, 0.75, 1);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(shaderProgram);

    gl.bindTexture(gl.TEXTURE_2D, userTexture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lightTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.uniform4f(uniform.userParam, customX, customY, customZ, customW);
    gl.uniform2ui(uniform.viewportSize, gl.canvas.width, gl.canvas.height);
    gl.uniform1ui(uniform.time, Date.now() - compileTime);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.drawElements(
        gl.TRIANGLES,
        6,                 // num vertices to process
        gl.UNSIGNED_SHORT, // type of indices
        0,                 // offset on bytes to indices
    );

    requestAnimationFrame(tick);
}

cxe.addEventListener('input', ev => { customX = cxe.valueAsNumber; });
cye.addEventListener('input', ev => { customY = cye.valueAsNumber; });
cze.addEventListener('input', ev => { customZ = cze.valueAsNumber; });
cwe.addEventListener('input', ev => { customW = cwe.valueAsNumber; });

window.addEventListener('load', main);
// main();