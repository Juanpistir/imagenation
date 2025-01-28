// Configurar SweetAlert2
window.Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

// Datos del usuario
window.USER_DATA = {
  user: typeof USER_JSON !== 'undefined' ? JSON.parse(USER_JSON) : null,
};

document.addEventListener('alpine:init', () => {
  Alpine.store('auth', {
    currentUser: null,
    userData: null,
    token: null,
    error: null,
    isLoading: false,

    // Propiedades computadas
    get isAuthenticated() {
      return !!this.currentUser;
    },

    get user() {
      return this.userData;
    },

    init() {
      // Usar directamente auth de firebaseClient
      const { auth } = window.firebaseClient;

      // Verificar si hay un usuario activo al iniciar
      this.currentUser = auth.currentUser;
      if (this.currentUser) {
        this.refreshToken();
      }

      this.setupAuthObserver();
    },

    setupAuthObserver() {
      // Usar directamente auth de firebaseClient
      const { auth } = window.firebaseClient;

      auth.onAuthStateChanged(async (user) => {
        // Mantener el objeto original de Firebase Auth
        this.currentUser = user;

        // Actualizar la UI con los datos normalizados del usuario
        this.userData = user
          ? {
              userId: user.uid,
              email: user.email || '',
              username: user.email?.split('@')[0] || '',
              displayName: user.displayName || user.email?.split('@')[0] || '',
              photoURL: user.photoURL || 'https://www.gravatar.com/avatar/0?d=mp',
              bio: user.bio || '',
              createdAt: user.metadata?.creationTime || null,
              updatedAt: user.metadata?.lastSignInTime || null,
              role: user.role || 'user',
              isActive: true,
              isAuthenticated: true
            }
          : null;

        // Debug de autenticación
        console.log('Estado de autenticación actualizado:', {
          currentUser: this.currentUser?.userId,
          userData: this.userData,
          isAuthenticated: this.isAuthenticated
        });

        if (user) {
          await this.refreshToken();
          this.setupTokenRefreshTimer();
        } else {
          this.clearAuthData();
        }
      });
    },

    async refreshToken(force = false) {
      try {
        if (!this.currentUser) return;

        const token = await this.currentUser.getIdToken(force);
        this.token = token;
        localStorage.setItem('token', token);

        // Configurar la cookie con atributos seguros
        const secure = location.protocol === 'https:';
        const sameSite = secure ? 'None' : 'Lax';
        document.cookie = `firebaseToken=${token}; path=/; ${secure ? 'Secure;' : ''} SameSite=${sameSite}${this.getTokenExpiry()}`;

        return token;
      } catch (error) {
        console.error('Error refreshing token:', error);
        this.handleAuthError(error);
      }
    },

    setupTokenRefreshTimer() {
      // Renovar cada 55 minutos (el token expira en 1 hora)
      setInterval(
        async () => {
          try {
            if (this.currentUser) {
              await this.refreshToken(true);
            }
          } catch (error) {
            console.error('Error in token refresh timer:', error);
          }
        },
        55 * 60 * 1000
      );
    },

    getTokenExpiry() {
      const expires = new Date();
      expires.setHours(expires.getHours() + 1);
      return `; expires=${expires.toUTCString()}`;
    },

    async login(email, password) {
      try {
        this.error = null;
        // Usar la función signIn de firebaseClient
        const user = await window.firebaseClient.signIn(email, password);

        // El currentUser se actualizará automáticamente a través del observer
        // Solo necesitamos esperar el token y redirigir
        const token = await this.refreshToken();
        if (token) {
          window.location.href = '/';
        }
      } catch (error) {
        this.handleAuthError(error, '/auth/login');
      }
    },

    async register(email, password) {
      try {
        this.isLoading = true;
        this.error = null;

        // 1. Crear usuario en el backend
        const response = await fetch('/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(errorData || 'Error al registrar usuario');
        }

        const data = await response.json();
        if (!data.success || !data.user) {
          throw new Error('Respuesta inválida del servidor');
        }

        // 2. Iniciar sesión con las credenciales
        const user = await window.firebaseClient.signIn(email, password);
        if (!user) {
          throw new Error('Error al iniciar sesión después del registro');
        }

        // 3. Obtener token y redirigir
        const token = await this.refreshToken();
        if (token) {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Error en registro:', error);
        this.handleAuthError(error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    clearAuthData() {
      this.currentUser = null;
      this.userData = null;
      this.token = null;
      const secure = location.protocol === 'https:';
      const sameSite = secure ? 'None' : 'Lax';
      document.cookie = `firebaseToken=; Max-Age=0; path=/; ${secure ? 'Secure;' : ''} SameSite=${sameSite}`;
    },

    async logout() {
      try {
        await window.firebaseClient.auth.signOut();
        this.clearAuthData();
        window.Toast.fire({
          icon: 'success',
          title: 'Sesión cerrada correctamente',
        });
        setTimeout(() => (window.location.href = '/auth/login'), 1500);
      } catch (error) {
        this.handleAuthError(error);
      }
    },

    async deleteImage(imageId) {
      try {
        if (!this.isAuthenticated || !imageId) {
          console.error('No autorizado o ID de imagen inválido');
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
          cancelButtonText: 'Cancelar'
        });

        if (!confirmed.isConfirmed) return;

        this.isLoading = true;

        const response = await fetch(`/api/images/${imageId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });

        if (!response.ok) {
          throw new Error('Error al eliminar la imagen');
        }

        Toast.fire({
          icon: 'success',
          title: 'Imagen eliminada correctamente'
        });

        // Redirigir al home después de eliminar
        window.location.href = '/';
      } catch (error) {
        console.error('Error al eliminar imagen:', error);
        Toast.fire({
          icon: 'error',
          title: 'Error al eliminar la imagen'
        });
      } finally {
        this.isLoading = false;
      }
    },

    async editImage(imageId, currentTitle, currentDescription) {
      try {
        if (!this.isAuthenticated) {
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
              Authorization: `Bearer ${this.token}`,
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

    async toggleLike(imageId) {
      try {
        if (!this.isAuthenticated) {
          Toast.fire({
            icon: 'error',
            title: 'Debes iniciar sesión para dar like',
          });
          return;
        }

        this.isLoading = true;

        const response = await fetch(`/images/${imageId}/like`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al actualizar el like');
        }

        const data = await response.json();

        // Actualizar UI localmente
        const likesElement = document.querySelector(`[data-image="${imageId}"] .likes-count`);
        const likeButton = document.querySelector(`[data-image="${imageId}"] .like-button`);

        if (likesElement) {
          likesElement.textContent = data.newLikesCount;
        }

        if (likeButton) {
          likeButton.classList.toggle('text-red-500', data.hasLiked);
          likeButton.setAttribute('title', data.hasLiked ? 'Quitar me gusta' : 'Me gusta');
        }

        Toast.fire({
          icon: 'success',
          title: data.hasLiked ? 'Me gusta añadido' : 'Me gusta removido',
        });
      } catch (error) {
        Toast.fire({
          icon: 'error',
          title: error.message,
        });
      } finally {
        this.isLoading = false;
      }
    },

    async submitComment(imageId, commentText) {
      try {
        if (!this.isAuthenticated) {
          Toast.fire({ icon: 'warning', title: 'Debes iniciar sesión para comentar' });
          return;
        }

        if (!commentText?.trim()) {
          Toast.fire({ icon: 'warning', title: 'El comentario no puede estar vacío' });
          return;
        }

        const response = await fetch(`/images/${imageId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({ text: commentText }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al publicar comentario');
        }

        const newComment = await response.json();

        // Actualizar UI sin recargar
        const commentsList = document.getElementById('commentsList');
        if (commentsList) {
          const commentHTML = this.createCommentHTML(newComment);
          commentsList.insertAdjacentHTML('afterbegin', commentHTML);
        }

        Toast.fire({ icon: 'success', title: '¡Comentario publicado!' });

        // Limpiar el formulario
        const commentForm = document.getElementById('commentForm');
        if (commentForm) {
          commentForm.reset();
        }
      } catch (error) {
        console.error('Error al publicar comentario:', error);
        Toast.fire({ icon: 'error', title: error.message });
      }
    },

    async deleteComment(imageId, commentId) {
      try {
        const result = await Swal.fire({
          title: '¿Eliminar comentario?',
          text: '¿Estás seguro de que quieres eliminar este comentario?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar',
        });

        if (!result.isConfirmed) {
          return;
        }

        const response = await fetch(`/images/${imageId}/comments/${commentId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al eliminar comentario');
        }

        // Eliminar el comentario del DOM
        const commentElement = document.querySelector(`[data-comment="${commentId}"]`);
        if (commentElement) {
          commentElement.remove();
        }

        Toast.fire({ icon: 'success', title: 'Comentario eliminado' });
      } catch (error) {
        console.error('Error al eliminar comentario:', error);
        Toast.fire({ icon: 'error', title: error.message });
      }
    },

    createCommentHTML(comment) {
      const isOwner = this.user?.userId === comment.userId;
      const isImageOwner =
        document.querySelector('[data-image-owner]')?.dataset.imageOwner === this.user?.userId;
      const showDeleteButton = isOwner || isImageOwner;

      return `
        <div class="bg-white p-4 rounded-lg shadow mb-4 hover:shadow-lg transition-shadow duration-200" 
             data-comment="${comment.id}">
          <div class="flex justify-between items-start">
            <div class="flex-grow">
              <div class="flex items-center gap-2 mb-2">
                <div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <i class="fas fa-user text-primary"></i>
                </div>
                <div>
                  <p class="font-medium text-gray-900">${comment.userEmail}</p>
                  <p class="text-xs text-gray-500">${new Date(comment.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <p class="text-gray-600 mt-1">${this.escapeHtml(comment.text)}</p>
            </div>
            ${
              showDeleteButton
                ? `
              <button @click="$store.auth.deleteComment('${comment.imageId}', '${comment.id}')" 
                      class="text-red-500 hover:text-red-600">
                <i class="fas fa-trash-alt"></i>
              </button>
            `
                : ''
            }
          </div>
        </div>
      `;
    },

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    handleAuthError(error, redirectPath = '/') {
      const errorMessage = this.getFriendlyError(error.code || error.message);
      this.error = errorMessage;
      console.error('Auth Error:', error);

      // Solo redirigir si es un error de autenticación y no estamos ya en la página principal
      if (
        redirectPath &&
        window.location.pathname !== '/' &&
        !window.location.search.includes('error=')
      ) {
        window.location.href = `${redirectPath}?error=${encodeURIComponent(errorMessage)}`;
      } else {
        window.Toast.fire({
          icon: 'error',
          title: errorMessage,
        });
      }
    },

    getFriendlyError(code) {
      const errorMessages = {
        'auth/id-token-expired': 'Tu sesión ha expirado. Por favor inicia sesión nuevamente',
        'auth/email-already-in-use': 'Este correo electrónico ya está registrado',
        'auth/invalid-email': 'El correo electrónico no es válido',
        'auth/operation-not-allowed': 'Operación no permitida',
        'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
        'auth/user-not-found': 'No existe una cuenta con este correo electrónico',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/too-many-requests': 'Demasiados intentos. Intenta nuevamente más tarde',
      };
      return errorMessages[code] || 'Ha ocurrido un error inesperado';
    },
  });

  // Store de búsqueda
  Alpine.store('search', {
    isSearching: false,
    searchQuery: '',
    searchResults: [],
    searchTimeout: null,
    isSpinning: false,
    minChars: 3,

    executeSearch() {
      if (this.searchQuery.length < this.minChars) {
        this.resetSearch();
        return;
      }

      // Cancelar la búsqueda anterior si existe
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      // Iniciar nueva búsqueda con debounce
      this.isSpinning = true;
      this.searchTimeout = setTimeout(async () => {
        try {
          const response = await this.fetchSearchResults();
          await this.handleSearchResponse(response);
        } catch (error) {
          this.handleSearchError(error);
        } finally {
          this.isSpinning = false;
        }
      }, 500); // Aumentado a 500ms para mejor rendimiento
    },

    resetSearch() {
      this.searchResults = [];
      this.isSpinning = false;
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
    },

    async fetchSearchResults() {
      const token = Alpine.store('auth').token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      return await fetch(`/images/search?query=${encodeURIComponent(this.searchQuery.trim())}`, {
        headers,
      });
    },

    async handleSearchResponse(response) {
      if (!response.ok) {
        if (response.status === 401) {
          Alpine.store('auth').handleAuthError({ code: 'auth/unauthorized' });
          return;
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.searchResults = data.images || [];
    },

    handleSearchError(error) {
      console.error('Search Error:', error);
      this.resetSearch();
      window.Toast.fire({
        icon: 'error',
        title: 'Error al realizar la búsqueda',
        text: 'Por favor, intenta de nuevo más tarde',
      });
    },
  });
});
