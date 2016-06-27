/*
    ISRH Práctica Final
    Beatriz Alarcón Iniesta
    2015-2016

    init.js
    versión: 1.0
*/

var url = "js/main.js";
$( "#joinroom" ).click(function() {
  if ($("#idroom").val() !== "") {
    if ($("#iduser").val() !== "") {
      $.getScript( url, function() {
      console.log("Cargo main!!!");
      $("#loginUI").hide();
      $("#container").show();
      });
    }else{
      alert("Please enter a username");
    }
  }else{
    alert("It is not possible to access the room ''");
  }
});
