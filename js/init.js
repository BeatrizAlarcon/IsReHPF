var url = "js/main.js";
$( "#joinroom" ).click(function() {
  if ($("#idroom").val() !== "") {
    if ($("#iduser").val() !== "") {
      $.getScript( url, function() {
      console.log("Cargo main!!!");
      });
    }else{
      alert("Please enter a username");
    }
  }else{
    alert("It is not possible to access the room ''");
  }
});
