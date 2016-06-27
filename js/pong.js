function initWebGL()
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
function initShaders(){};
function setupBuffers(){};
function getMatrixUniforms(){};
function setupWebGL(){};
function setMatrixUniforms(){};
function requestAnimationFrame(animLoop, canvas){};
