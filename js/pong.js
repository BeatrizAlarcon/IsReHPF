/*
    ISRH Práctica Final
    Beatriz Alarcón Iniesta
    2015-2016

    pong.js
    versión: 1.0
*/

//------------------------------ Keys ------------------------------------------
// e.keyCode == 39 left key
//e.keyCode == 37 rigth key

$(document).ready(function () {
    $('body').keydown(function(e){
        if (e.keyCode == 39) {
					//console.log("left!!");
            if (isInitiator) {
                incrA_x = 0.05;
            } else {
                incrB_x = 0.05;
            }
        } else if (e.keyCode == 37) {
					//console.log("rigth!!");
            if (isInitiator) {
                incrA_x = -0.05;
            } else {
                incrB_x = -0.05;
            }
        }
    });
    $('body').keyup(function(e){
        if (e.keyCode == 37 || e.keyCode == 39) {
            if (isInitiator) {
                incrA_x = 0.0;
            } else {
                incrB_x = 0.0;
            }
        }
    });
});
//------------------------------ end Keys --------------------------------------

var gl = null,
	canvas = null,
	glProgram = null,
	fragmentShader = null,
	vertexShader = null;

var vertexPositionAttribute = null,
	trianglesVerticeBuffer = null,
	vertexColorAttribute = null,
	trianglesColorBuffer = null,
	triangleVerticesIndexBuffer = null;

//Scores
var scoreA = 0;
var scoreB = 0;

//Matrix
//Paddle A
var mvMatrixA = mat4.create(),
	pMatrix = mat4.create();
//Paddle B
var mvMatrixB = mat4.create();
//Ball
var mvMatrixP = mat4.create();
//Top wall
var mvMatrixWT = mat4.create();
//Right wall
var mvMatrixWR = mat4.create();
//Bottom wall
var mvMatrixWB = mat4.create();
//Left wall
var mvMatrixWL = mat4.create();

//Size
//Paddle
var widthPaddle = 0.3;
var heightPaddle = 0.15;
//Arena
var widthArena = 0.75;
var heightArena = 1.5;
//Ball
var sideBall = heightPaddle;

//Position & movement speed
//Paddle A
var posA_x = 0.0;
var posA_y = heightArena;
var incrA_x = 0.0;
//Paddle B
var posB_x = 0.0;
var posB_y = -heightArena;
var incrB_x = 0.0;
//Ball
var posP_x = 0.0;
var posP_y = 0.0;
var incrP_x = randomBall();
var incrP_y = randomBall();

//Walls
//Size
var shortWall = sideBall;
var verticalWall = 2*(heightArena + widthPaddle + shortWall) + 0.05;
var horizontalWall = 2*(widthArena + shortWall);
//Top
var posWT_x = 0.0;
var posWT_y = heightArena + shortWall;
//Right
var posWR_x = widthArena + shortWall - 0.05;
var posWR_y = 0.0;
//Bottom
var posWB_x = 0.0;
var posWB_y = -posWT_y;
//Left
var posWL_x = -posWR_x;
var posWL_y = 0.0;


function initWebGL(isInitiator)
{
	canvas = document.getElementById("pong");
	try{
		gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
	}catch(e){
	}

	if(gl)
	{
		initShaders();
		setupBuffers();
		getMatrixUniforms();
		(function animLoop(){
			setupWebGL();
			setMatrixUniforms();
			requestAnimationFrame(animLoop, canvas);
		})();
	}else{
		alert(  "Error: Your browser does not appear to support WebGL.");
	}
}

function setupWebGL()
{
	//set the clear color to a shade of black
	gl.clearColor(0, 0, 0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.enable(gl.DEPTH_TEST);

	gl.viewport(0, 0, canvas.width, canvas.height);
	mat4.perspective(45, canvas.width / canvas.height, 0.1, 100.0, pMatrix);

    if (isInitiator) {
        mat4.rotate(pMatrix, 3.141592/8, [0,1,0])
        mat4.translate(pMatrix, [3,0,0])
    } else {
        mat4.rotate(pMatrix, -3.141592/8, [0,1,0])
        mat4.translate(pMatrix, [-3,0,0])
    }

    //Paddle A
	mat4.identity(mvMatrixA);
	mat4.translate(mvMatrixA, [posA_x, posA_y, -7.0]);
    //Paddle B
	mat4.identity(mvMatrixB);
	mat4.translate(mvMatrixB, [posB_x, posB_y, -7.0]);
	//Ball
	mat4.identity(mvMatrixP);
	mat4.translate(mvMatrixP, [posP_x, posP_y, -7.0]);
	//Top wall
	mat4.identity(mvMatrixWT);
	mat4.translate(mvMatrixWT, [posWT_x, posWT_y, -7.0]);
	//Right wall
	mat4.identity(mvMatrixWR);
	mat4.translate(mvMatrixWR, [posWR_x, posWR_y, -7.0]);
	//Bottom wall
	mat4.identity(mvMatrixWB);
	mat4.translate(mvMatrixWB, [posWB_x, posWB_y, -7.0]);
	//Left wall
	mat4.identity(mvMatrixWL);
	mat4.translate(mvMatrixWL, [posWL_x, posWL_y, -7.0]);
}

function initShaders()
{
	//get shader source
	var fs_source = document.getElementById('shader-fs').innerHTML,
	vs_source = document.getElementById('shader-vs').innerHTML;

	//compile shaders
  vertexShader = makeShader(vs_source, gl.VERTEX_SHADER);
	fragmentShader = makeShader(fs_source, gl.FRAGMENT_SHADER);

	//create program
	glProgram = gl.createProgram();

	//attach and link shaders to the program
    gl.attachShader(glProgram, vertexShader);
    gl.attachShader(glProgram, fragmentShader);
    gl.linkProgram(glProgram);

    if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program.");
    }

	//use program
	gl.useProgram(glProgram);
}

function makeShader(src, type)
{
	//compile the vertex shader
	var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("Error compiling shader: " + gl.getShaderInfoLog(shader));
    }
	return shader;
}

function setupBuffers()
{


  var triangleVerticeColorGreen = [
  //front face
   0.0, 1.0, 0.0,
   1.0, 1.0, 0.0,
   1.0, 1.0, 0.0,
   1.0, 1.0, 0.0,
   1.0, 1.0, 0.0,
   1.0, 1.0, 0.0,

  //rear face
   0.0, 1.0, 1.0,
   0.0, 1.0, 1.0,
   0.0, 1.0, 1.0,
   0.0, 1.0, 1.0,
   0.0, 1.0, 1.0,
   0.0, 1.0, 1.0
  ];
    trianglesColorBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, trianglesColorBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVerticeColorGreen), gl.STATIC_DRAW);

  var triangleVerticeColorBlue = [
    //front face
     0.0, 0.0, 1.0,
     1.0, 1.0, 1.0,
     0.0, 0.0, 1.0,
     0.0, 0.0, 1.0,
     0.0, 0.0, 1.0,
     1.0, 1.0, 1.0,

    //rear face
     0.0, 1.0, 1.0,
     1.0, 1.0, 1.0,
     0.0, 1.0, 1.0,
     0.0, 1.0, 1.0,
     0.0, 1.0, 1.0,
     1.0, 1.0, 1.0
  ];

	trianglesColorBuffer2 = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, trianglesColorBuffer2);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVerticeColorBlue), gl.STATIC_DRAW);


  var triangleVerticeColorPink = [
  //front face
   1.0, 0.0, 1.0,
   1.0, 1.0, 1.0,
   1.0, 0.0, 1.0,
   1.0, 0.0, 1.0,
   1.0, 0.0, 1.0,
   1.0, 1.0, 1.0,

  //rear face
   1.0, 1.0, 1.0,
   1.0, 1.0, 1.0,
   1.0, 1.0, 1.0,
   1.0, 1.0, 1.0,
   1.0, 1.0, 1.0,
   1.0, 1.0, 1.0
];

	trianglesColorBuffer3 = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, trianglesColorBuffer3);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVerticeColorPink), gl.STATIC_DRAW);

	//8 vertices
	var triangleVertices = [
		//front face
		0.5, 0.5, 0.5,
		-0.5, 0.5, 0.5,
		-0.5, -0.5, 0.5,
		0.5, -0.5, 0.5,

		//rear face
		0.5, 0.5, -0.5,
		-0.5, 0.5, -0.5,
		-0.5, -0.5, -0.5,
		0.5, -0.5, -0.5,
	];

	trianglesVerticeBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, trianglesVerticeBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.STATIC_DRAW);

	//setup vertice buffers
	//18 triangles
	var triangleVertexIndices = [
		//front face
		0,1,3,
		1,2,3,

		//rear face
		4,5,7,
		5,6,7,

		//left side
		0,3,7,
		0,4,7,

		//right side
		1,2,6,
		1,5,6,

		//bottom face
		0,1,4,
		1,4,5,

		//top face
		2,3,7,
		2,6,7
	];
	triangleVerticesIndexBuffer = gl.createBuffer();
	triangleVerticesIndexBuffer.number_vertex_points = triangleVertexIndices.length;
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleVerticesIndexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangleVertexIndices), gl.STATIC_DRAW);
}

function checkScore(posy) {
    var isA = (posy>0 != isInitiator);
		//console.log("isA ="+ isA);
		//console.log(isInitiator);
		if (isA){
			scoreA += 1;
			$('#scoreA').html(scoreA);
		} else {
			scoreB += 1;
			$('#scoreB').html(scoreB);
		}
}

function hitPaddle(ball, paddle) {
    return ball<paddle+widthPaddle/2 && ball>paddle-widthPaddle/2;
}

function randomBall() {
    return 0.03*Math.random()+0.01;
}

function moveBall(x, y, incr_x, incr_y){
    if ((Math.abs(x) > widthArena) && (Math.sign(x)==Math.sign(incr_x))) {
        incr_x = -Math.sign(x)*Math.abs(incr_x);
    }
    if ((Math.abs(y) > heightArena-heightPaddle) && (Math.abs(y) < heightArena))  {
        if (incr_y<0 && y<0) {
            if (hitPaddle(x, posB_x)) {
                incr_y = -Math.sign(y)*randomBall();
            }
        } else if (incr_y>0 && y>0) {
            if (hitPaddle(x, posA_x)) {
                incr_y = -Math.sign(y)*randomBall();
            }
        }
    }
    if (Math.abs(y) > heightArena) {
        incr_y = -Math.sign(y)*randomBall();
        checkScore(y);
    }
    return [x+incr_x, y+incr_y, incr_x, incr_y];
}

function movePaddle(pos, incr){
    if (Math.abs(pos+incr) < (widthArena-widthPaddle/2)) {
        return pos+incr
    }
    return pos
}

function movement() {
    if (!sendButton.disabled) {
        if (isInitiator) {
            posP = moveBall(posP_x, posP_y, incrP_x, incrP_y);
            posP_x = posP[0];
            posP_y = posP[1];
            incrP_x = posP[2];
            incrP_y = posP[3];
            posA_x = movePaddle(posA_x, incrA_x);
            sendPos(posA_x, posP_x, posP_y);
        } else {
            posB_x = movePaddle(posB_x, incrB_x);
            sendPos(posB_x, posP_x, posP_y);
        }
    }
}

function drawScene(color) {
	vertexPositionAttribute = gl.getAttribLocation(glProgram, "aVertexPosition");
    gl.enableVertexAttribArray(vertexPositionAttribute);
	gl.bindBuffer(gl.ARRAY_BUFFER, trianglesVerticeBuffer);
	gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

	vertexColorAttribute = gl.getAttribLocation(glProgram, "aVertexColor");
    gl.enableVertexAttribArray(vertexColorAttribute);
	gl.bindBuffer(gl.ARRAY_BUFFER, color);
	gl.vertexAttribPointer(vertexColorAttribute, 3, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleVerticesIndexBuffer);
	gl.drawElements(gl.TRIANGLES, triangleVerticesIndexBuffer.number_vertex_points, gl.UNSIGNED_SHORT, 0);
}

function getMatrixUniforms(){
    glProgram.pMatrixUniform = gl.getUniformLocation(glProgram, "uPMatrix");
    glProgram.mvMatrixUniform = gl.getUniformLocation(glProgram, "uMVMatrix");
}


function setMatrixUniforms() {
    gl.uniformMatrix4fv(glProgram.pMatrixUniform, false, pMatrix);
    movement();

    //Ball
    mat4.scale(mvMatrixP, [heightPaddle, heightPaddle, heightPaddle]);
    mat4.translate(mvMatrixP, [posP_x, posP_y, -3]);
    gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, mvMatrixP);
    drawScene(trianglesColorBuffer2);

    //Paddle A
    mat4.scale(mvMatrixA, [widthPaddle, heightPaddle, heightPaddle]);
    mat4.translate(mvMatrixA, [posA_x, posA_y, -3]);
    gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, mvMatrixA);
    drawScene(trianglesColorBuffer3);

    //Paddle B
    mat4.scale(mvMatrixB, [widthPaddle, heightPaddle, heightPaddle]);
    mat4.translate(mvMatrixB, [posB_x, posB_y, -3]);
    gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, mvMatrixB);
    drawScene(trianglesColorBuffer3);

    //Top wall
    mat4.scale(mvMatrixWT, [horizontalWall, shortWall, shortWall]);
    mat4.translate(mvMatrixWT, [posWT_x, posWT_y, -3]);
    gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, mvMatrixWT);
    drawScene(trianglesColorBuffer);

    //Right wall
    mat4.scale(mvMatrixWR, [shortWall, verticalWall, shortWall]);
    mat4.translate(mvMatrixWR, [posWR_x, posWR_y, -3]);
    gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, mvMatrixWR);
    drawScene(trianglesColorBuffer);

    //Bottom wall
    mat4.scale(mvMatrixWB, [horizontalWall, shortWall, shortWall]);
    mat4.translate(mvMatrixWB, [posWB_x, posWB_y, -3]);
    gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, mvMatrixWB);
    drawScene(trianglesColorBuffer);

    //Left wall
    mat4.scale(mvMatrixWL, [shortWall, verticalWall, shortWall]);
    mat4.translate(mvMatrixWL, [posWL_x, posWL_y, -3]);
    gl.uniformMatrix4fv(glProgram.mvMatrixUniform, false, mvMatrixWL);
    drawScene(trianglesColorBuffer);
}
