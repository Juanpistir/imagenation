document.addEventListener('alpine:init', () => {
  if (!Alpine.store('image')) {
    Alpine.store('image', {
      likes: 0,
      liked: false,
      isLoading: false,
      commentText: '',
      comments: [],

      init() {
        try {
          // Inicializar con valores por defecto
          this.likes = 0;
          this.liked = false;
          this.comments = [];
          this.commentText = '';
          this.isLoading = false;

          // Si hay datos de imagen, actualizar el store
          if (window.IMAGE_DATA) {
            this.likes = window.IMAGE_DATA.likes ?? 0;
            this.liked = window.IMAGE_DATA.hasLiked ?? false;
            this.comments = window.IMAGE_DATA.comments || [];
            
            console.log('[IMAGE] Store inicializado:', {
              likes: this.likes,
              liked: this.liked,
              comments: this.comments.length
            });
          } else {
            console.warn('[IMAGE] No se encontraron datos de imagen, usando valores por defecto');
          }
        } catch (error) {
          console.error('[IMAGE] Error en inicialización:', error);
        }
      },

      async toggleLike(imageId) {
        if (!Alpine.store('auth')?.isAuthenticated) {
          Toast.fire({
            icon: 'error',
            title: 'Debes iniciar sesión para dar like'
          });
          return;
        }

        try {
          this.isLoading = true;
          const response = await fetch(`/api/images/${imageId}/like`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({})
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error al dar like: ${errorText}`);
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('La respuesta del servidor no es JSON válido');
          }

          const data = await response.json();
          this.likes = data.likes;
          this.liked = data.hasLiked;
        } catch (error) {
          console.error('[IMAGE] Error en toggleLike:', error);
          Toast.fire({
            icon: 'error',
            title: error.message || 'Error al dar like'
          });
        } finally {
          this.isLoading = false;
        }
      },

      async deleteImage(imageId) {
        try {
          if (!Alpine.store('auth').isAuthenticated) {
            console.error('No autorizado');
            return;
          }

          const confirmed = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
          });

          if (!confirmed.isConfirmed) return;

          this.isLoading = true;

          const response = await fetch(`/api/images/${imageId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${Alpine.store('auth').token}`,
            },
          });

          if (!response.ok) {
            throw new Error('Error al eliminar la imagen');
          }

          Toast.fire({
            icon: 'success',
            title: 'Imagen eliminada correctamente',
          });

          // Redirigir al home después de eliminar
          window.location.href = '/';
        } catch (error) {
          console.error('Error al eliminar imagen:', error);
          Toast.fire({
            icon: 'error',
            title: 'Error al eliminar la imagen',
          });
        } finally {
          this.isLoading = false;
        }
      },

      async editImage(imageId, currentTitle, currentDescription) {
        try {
          if (!Alpine.store('auth').isAuthenticated) {
            Toast.fire({
              icon: 'warning',
              title: 'Debes iniciar sesión para editar imágenes',
            });
            return;
          }

          const { value: formValues } = await Swal.fire({
            title: 'Editar imagen',
            html: `
              <div class="text-left">
                <label class="block mb-2 text-gray-700">Título:</label>
                <input 
                  id="swal-title" 
                  class="swal2-input w-full !m-0 !mt-1 !mb-4"
                  value="${currentTitle?.replace(/"/g, '&quot;') || ''}"
                  required
                >
                <label class="block mb-2 text-gray-700">Descripción:</label>
                <textarea 
                  id="swal-description" 
                  class="swal2-textarea w-full !m-0 !mt-1"
                  rows="4"
                >${currentDescription || ''}</textarea>
              </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            customClass: {
              confirmButton: 'bg-primary hover:bg-primary-dark',
              cancelButton: 'bg-gray-500 hover:bg-gray-600',
            },
            preConfirm: () => {
              const title = document.getElementById('swal-title').value.trim();
              const description = document.getElementById('swal-description').value.trim();

              if (!title) {
                Swal.showValidationMessage('El título es obligatorio');
                return false;
              }

              return { title, description };
            },
          });

          if (formValues) {
            const response = await fetch(`/images/${imageId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Alpine.store('auth').token}`,
              },
              body: JSON.stringify(formValues),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Error al actualizar la imagen');
            }

            // Actualizar la UI sin recargar
            const titleElement = document.querySelector('h3.text-2xl.font-bold');
            const descriptionElement = document.querySelector('p.text-gray-700.mb-6');

            if (titleElement) titleElement.textContent = formValues.title;
            if (descriptionElement) {
              descriptionElement.textContent = formValues.description || '';
              descriptionElement.style.display = formValues.description ? 'block' : 'none';
            }

            Toast.fire({
              icon: 'success',
              title: '¡Imagen actualizada correctamente!',
            });
          }
        } catch (error) {
          console.error('Error al editar imagen:', error);
          Toast.fire({
            icon: 'error',
            title: error.message || 'No se pudo actualizar la imagen',
          });
        }
      },

      async submitComment(imageId) {
        try {
          if (!Alpine.store('auth').isAuthenticated) {
            Toast.fire({
              icon: 'error',
              title: 'Debes iniciar sesión para comentar',
            });
            return;
          }

          if (!this.commentText.trim()) {
            Toast.fire({
              icon: 'warning',
              title: 'El comentario no puede estar vacío',
            });
            return;
          }

          this.isLoading = true;

          const response = await fetch(`/images/${imageId}/comments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Alpine.store('auth').token}`,
            },
            body: JSON.stringify({ text: this.commentText }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al publicar el comentario');
          }

          const comment = await response.json();

          // Añadir el comentario al DOM
          const commentsContainer = document.querySelector('#comments-container');
          if (commentsContainer) {
            commentsContainer.insertAdjacentHTML('afterbegin', this.createCommentHTML(comment));
          }

          // Limpiar el campo de comentario
          this.commentText = '';

          Toast.fire({
            icon: 'success',
            title: '¡Comentario publicado!',
          });
        } catch (error) {
          console.error('Error al publicar comentario:', error);
          Toast.fire({
            icon: 'error',
            title: error.message || 'No se pudo publicar el comentario',
          });
        } finally {
          this.isLoading = false;
        }
      },

      async deleteComment(imageId, commentId) {
        try {
          const confirmed = await Swal.fire({
            title: '¿Eliminar comentario?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
          });

          if (!confirmed.isConfirmed) return;

          this.isLoading = true;

          const response = await fetch(`/images/${imageId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${Alpine.store('auth').token}`,
            },
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al eliminar el comentario');
          }

          // Eliminar el comentario del DOM
          const commentElement = document.querySelector(`#comment-${commentId}`);
          if (commentElement) {
            commentElement.remove();
          }

          Toast.fire({
            icon: 'success',
            title: 'Comentario eliminado',
          });
        } catch (error) {
          console.error('Error al eliminar comentario:', error);
          Toast.fire({
            icon: 'error',
            title: error.message || 'No se pudo eliminar el comentario',
          });
        } finally {
          this.isLoading = false;
        }
      },

      createCommentHTML(comment) {
        const auth = Alpine.store('auth');
        const canDelete =
          auth.isAuthenticated &&
          (comment.userId === auth.currentUser?.uid ||
            window.IMAGE_DATA?.userId === auth.currentUser?.uid);

        return `
          <div id="comment-${comment.id}" class="flex justify-between items-start mb-4 comment-item">
            <div class="flex-grow">
              <div class="flex items-center">
                ${
                  comment.userPhotoURL
                    ? `<img src="${this.escapeHtml(comment.userPhotoURL)}" alt="${this.escapeHtml(comment.userDisplayName)}" class="h-8 w-8 rounded-full mr-2">`
                    : `<div class="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-medium uppercase mr-2">
                      ${this.escapeHtml(comment.userDisplayName?.[0] || '?')}
                     </div>`
                }
                <span class="font-medium">${this.escapeHtml(comment.userDisplayName)}</span>
                <span class="text-gray-500 text-sm ml-2">${timeago.format(comment.timestamp)}</span>
              </div>
              <p class="text-gray-600 mt-1">${this.escapeHtml(comment.text)}</p>
            </div>
            ${
              canDelete
                ? `
              <button onclick="$store.image.deleteComment('${window.IMAGE_DATA.id}', '${comment.id}')" 
                      class="text-red-500 hover:text-red-600">
                <i class="fas fa-trash-alt"></i>
              </button>
            `
                : ''
            }
          </div>
        `;
      },

      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      },
    });
  }
});
