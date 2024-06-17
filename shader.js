'use strict';
/** @type {HTMLButtonElement} */
const compileButton = document.getElementById("compile-button");
/** @type {HTMLTextAreaElement} */
const fragSource = document.getElementById('fragsrc');
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("glcanv");
/** @type {HTMLSpanElement} */
const compileStatus = document.getElementById("glstatus");

/** @type {HTMLInputElement} */
const cxe = document.getElementById('custom-x');
/** @type {HTMLInputElement} */
const cye = document.getElementById('custom-y');
/** @type {HTMLInputElement} */
const cze = document.getElementById('custom-z');
/** @type {HTMLInputElement} */
const cwe = document.getElementById('custom-w');

/** @type {HTMLLabelElement} */
const cxle = document.getElementById('custom-x-value');
/** @type {HTMLLabelElement} */
const cyle = document.getElementById('custom-y-value');
/** @type {HTMLLabelElement} */
const czle = document.getElementById('custom-z-value');
/** @type {HTMLLabelElement} */
const cwle = document.getElementById('custom-w-value');

/** @type {HTMLImageElement} */
const imge = document.getElementById('glimg');
/** @type {HTMLSelectElement} */
const twxe = document.getElementById('wrap-x');
/** @type {HTMLSelectElement} */
const twye = document.getElementById('wrap-y');
/** @type {HTMLPreElement} */
const errorBox = document.getElementById('error');

/** @type {HTMLImageElement} */
const lightimg = document.getElementById('lightimg');

/** @type {WebGL2RenderingContext} */
let gl = canvas.getContext('webgl2');

const vertexSource = `#version 300 es

in vec2 a_position;
in vec2 a_texCoord;

out vec2 texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    texCoord = a_texCoord;
}
`;

/** @type {WebGLShader} */
let vertexShader = null;
/** @type {WebGLProgram} */
let shaderProgram = null;
/** @type {WebGLBuffer} */
let positionBuffer = null;
/** @type {WebGLBuffer} */
let texCoordBuffer = null;
/** @type {WebGLBuffer} */
let indexBuffer = null;

const attributeLoc = {
    /** @property {GLuint>} */
    position: null,
    /** @property {GLuint>} */
    texCoord: null
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

let useAbsoluteViewport = false;
let customX = 0;
let customY = 0;
let customZ = 0;
let customW = 1;

let compileTime = Date.now();

const vertices = new Float32Array([
    -1.0, -1.0, // bottom left
    1.0, -1.0,  // bottom right
    1.0, 1.0,   // top right
    -1.0, 1.0,  // top left
]);

const coords = new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
]);

const indices = new Uint16Array([
    0, 1, 2,
    2, 3, 0
]);

requestAnimationFrame = requestAnimationFrame || webkitRequestAnimationFrame;

function updateError(err) {
    errorBox.hidden = false;
    errorBox.innerText = err.message;
}

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
        updateError(e);
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
        updateError(e);
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
    attributeLoc.texCoord = gl.getAttribLocation(shaderProgram, 'a_texCoord');
    // uniforms
    uniform.userParam = gl.getUniformLocation(shaderProgram, 'userParam');
    uniform.viewportSize = gl.getUniformLocation(shaderProgram, 'viewportSize');
    uniform.time = gl.getUniformLocation(shaderProgram, 'time');
    compileTime = Date.now();
    errorBox.hidden = true;
    updateTextureWrap();
}

function main() {
    vertexShader = gl.createShader(gl.VERTEX_SHADER);

    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        let e = new Error(gl.getShaderInfoLog(vertexShader));
        gl.deleteShader(vertexShader);
        gl.deleteProgram(shaderProgram);
        updateError(e);
        throw e;
    };

    updateShaders();

    positionBuffer = gl.createBuffer();
    texCoordBuffer = gl.createBuffer();
    indexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
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

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(attributeLoc.texCoord);
    gl.vertexAttribPointer(
        attributeLoc.texCoord,
        2,
        gl.FLOAT,
        false, // normalize
        0,     // stride (0 = auto)
        0,     // offset into buffer
    );


    userTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, userTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
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

    requestAnimationFrame(tick);

    compileButton.addEventListener('click', () => {
        updateShaders();
    });
}

function updateTextureWrap() {
    gl.bindTexture(gl.TEXTURE_2D, userTexture);
    let wrapX;
    switch (twxe.selectedIndex) {
        case 1: { wrapX = gl.CLAMP_TO_EDGE; break; }
        case 2: { wrapX = gl.MIRRORED_REPEAT; break; }
        case 0:
        default: { wrapX = gl.REPEAT; break; }
    }
    let wrapY;
    switch (twye.selectedIndex) {
        case 1: { wrapY = gl.CLAMP_TO_EDGE; break; }
        case 2: { wrapY = gl.MIRRORED_REPEAT; break; }
        case 0:
        default: { wrapY = gl.REPEAT; break; }
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapX);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapY);
}

function tick() {
    // gl.clearColor(0.125, 0.25, 0.75, 1);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(shaderProgram);

    updateTextureWrap();

    gl.bindTexture(gl.TEXTURE_2D, userTexture);
    gl.activeTexture(gl.TEXTURE0);

    gl.uniform4f(uniform.userParam, customX, customY, customZ, customW);
    gl.uniform2ui(uniform.viewportSize, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(uniform.time, Date.now() - compileTime);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.drawElements(
        gl.TRIANGLES,
        6,                 // num vertices to process
        gl.UNSIGNED_SHORT, // type of indices
        0,                 // offset on bytes to indices
    );

    requestAnimationFrame(tick);
}

cxe.addEventListener('input', ev => { customX = cxe.valueAsNumber; cxle.innerText = customX; });
cye.addEventListener('input', ev => { customY = cye.valueAsNumber; cyle.innerText = customY; });
cze.addEventListener('input', ev => { customZ = cze.valueAsNumber; czle.innerText = customZ; });
cwe.addEventListener('input', ev => { customW = cwe.valueAsNumber; cwle.innerText = customW; });

window.addEventListener('load', main);
// main();
