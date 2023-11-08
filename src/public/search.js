$(document).ready(function () {
  const searchForm = $('form[role="search"]');
  const searchInput = $('input[type="search"]');
  const searchResults = $("#searchResults");

  searchForm.submit(async function (event) {
    event.preventDefault();
    const searchTerm = searchInput.val().trim(); // Obtiene el valor del campo de búsqueda

    if (searchTerm) {
      try {
        const response = await fetch(`/image/search?title=${searchTerm}`);
        const images = await response.json();

        // Lógica para mostrar los resultados en el documento HTML
        displaySearchResults(images);
      } catch (error) {
        console.error("Error al buscar imágenes:", error);
      }
    }
  });

  function displaySearchResults(response) {
    const images = response.results; // Extrae las imágenes del objeto JSON recibido

    if (images && images.length > 0) {
      searchResults.html(""); // Limpiar resultados anteriores

      images.forEach((image) => {
        const imageDiv = $('<div class="image-info" style="margin: 10px;">');
        const imageLink = $(`<a href="/images/${image.filename}"></a>`);
        const imageElement = $("<img>");

        // Usa imgSrc en lugar de la ruta al archivo
        imageElement.attr("src", image.imgSrc);
        imageElement.attr("alt", image.title);
        imageElement.addClass("img-thumbnail");
        imageElement.css("width", "100px");

        const title = $(`<h4>${image.title}</h4>`);
        const description = $(`<p>${image.description}</p>`);

        imageLink.append(imageElement);
        imageDiv.append(imageLink);
        imageDiv.append(title);
        imageDiv.append(description);
        searchResults.append(imageDiv);
      });
    } else {
      searchResults.html('<p class="ml-3">No se encontraron imágenes</p>');
    }
  }
});
