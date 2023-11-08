//JQUERY  

$("#post-comment").hide(); // Permite ocultar el blockquoute con los formularios
$("#btn-toggle-comment").click((e) => {
  e.preventDefault();
  $("#post-comment").slideToggle(); // Muestra los formularios
});

// Establecemos una función que nos permite hacer una petición POST a la imagen correcta para subir los likes cuando damos click al boton.

$("#btn-like").click(function (e) {

  e.preventDefault(); // Con esta función prevenimos que se recargue la página

  let imgId = $(this).data("id"); // Almacenamos en una variable la información del boton id, en este caso la información es la dirección de la url.

  // console.log(imgId); para comprobar que esta funcionando.

  $.post("/images/" + imgId + "/like").done((data) => {
    // Enviamos la petición post a la ruta especifica para que el controlador la maneje.
    console.log(data);

    $(".likes-count").text(data.likes); //Establecemos en la clase "likes-count" que introduzca la cantidad total de likes
  });
});

$("#btn-delete").click(function (e) {
  //Escogemos el id "btn-delete" que cuando hagamos click nos muestre una pestaña de confirmación para que si respondemos aceptar eliminar la imagen.

  e.preventDefault();
  let $this = $(this);
  const response = confirm("¿Estas seguro de eliminar esta imagen?");
  if (response) {
    let imgId = $this.data("id");
    $.ajax({
      //Haciendo uso de ajax para usar la petición "DELETE"
      url: "/images/" + imgId,
      type: "DELETE",
    }).done(function () {
      //Una vez que este realizada la petición cambiamos las clases y su contenido para que se visualice de forma distinta.
      $this.removeClass("btn-danger").addClass("btn-success");
      $this.find("i").removeClass("fa-times").addClass("fa-check"); //con removeClass y addClass permite eliminar clases y añadir clases distintas.
      $this.find("span").remove(); //.remove sirve para eliminar completamente el span para así reemplazarlo por otro
      $this.append("<span>Eliminado!</span>");
    });
  }
});
