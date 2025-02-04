document.addEventListener('alpine:init', () => {
  Alpine.store('profile', {
    isEditing: false,
    isLoading: false,
    error: null,
    usernameAvailable: true,
    usernameChecking: false,
    activeTab: 'posts',
    likedImages: [],
    collections: [],
    showNewCollectionModal: false,
    profile: {
      ...(window.PROFILE_DATA || {}),
      username: window.PROFILE_DATA?.username || '',
      displayName: window.PROFILE_DATA?.displayName || '',
      bio: window.PROFILE_DATA?.bio || '',
      photoURL: window.PROFILE_DATA?.photoURL || '',
      uid: window.PROFILE_DATA?.uid || '',
      email: window.PROFILE_DATA?.email || '',
      role: window.PROFILE_DATA?.role || 'user',
      isActive: window.PROFILE_DATA?.isActive ?? true,
      images: window.PROFILE_DATA?.images || [],
    },
    // Inicializar formData con valores por defecto
    formData: {
      displayName: window.PROFILE_DATA?.displayName || '',
      username: window.PROFILE_DATA?.username || '',
      bio: window.PROFILE_DATA?.bio || '',
      photoFile: null,
      bannerFile: null,
    },

    async init() {
      try {
        const auth = Alpine.store('auth');

        // Debug de comparación UIDs
        console.log('Debug Comparación UIDs:', {
          'Auth.isAuthenticated': auth?.isAuthenticated,
          'Auth.currentUser': auth?.currentUser,
          'Profile.uid': this.profile?.uid,
          'Son iguales?': auth?.currentUser === this.profile?.uid,
          'Tipo Auth.currentUser': typeof auth?.currentUser,
          'Tipo Profile.uid': typeof this.profile?.uid,
        });

        // Esperar a que la autenticación esté lista
        await new Promise((resolve) => {
          if (auth?.isAuthenticated && auth?.currentUser) {
            resolve();
          } else {
            const checkAuth = () => {
              if (auth?.isAuthenticated && auth?.currentUser) {
                document.removeEventListener('alpine:init', checkAuth);
                resolve();
              }
            };
            document.addEventListener('alpine:init', checkAuth);
            // Timeout de seguridad después de 5 segundos
            setTimeout(() => {
              document.removeEventListener('alpine:init', checkAuth);
              resolve();
            }, 5000);
          }
        });

        // Si no hay datos de perfil, intentar obtener del auth store
        if (!this.profile.username && auth?.userData) {
          const userData = auth.userData;
          this.profile = {
            ...this.profile,
            uid: auth?.currentUser?.uid || '',
            username: userData?.username || '',
            displayName: userData?.displayName || '',
            email: userData?.email || '',
            photoURL: userData?.photoURL || '',
            bio: userData?.bio || '',
          };
        }

        // Actualizar formData con los datos actuales
        this.formData = {
          displayName: this.profile.displayName || '',
          username: this.profile.username || '',
          bio: this.profile.bio || '',
          photoFile: null,
          bannerFile: null,
        };

        // Observar cambios en la autenticación usando Alpine.effect
        Alpine.effect(() => {
          const currentUser = Alpine.store('auth')?.currentUser;
          if (currentUser) {
            this.profile.uid = currentUser.uid;
            this.loadLikedImages();
            this.loadCollections();
          }
        });

        // Cargar datos adicionales de manera segura
        await this.loadLikedImages();
        await this.loadCollections();
      } catch (error) {
        console.error('Error en inicialización del perfil:', error);
      }
    },

    setActiveTab(tab) {
      this.activeTab = tab;
      if (tab === 'likes') {
        this.loadLikedImages();
      } else if (tab === 'collections') {
        this.loadCollections();
      }
    },

    async loadLikedImages() {
      try {
        const auth = Alpine.store('auth');
        if (!auth?.currentUser?.uid) {
          console.warn('No hay usuario autenticado para cargar likes');
          return;
        }

        this.isLoading = true;
        
        // Asegurar que userId sea un string válido
        const userId = auth?.currentUser?.uid || this.profile?.uid;
        
        if (!userId) {
          console.warn('No se pudo obtener un ID de usuario válido');
          return;
        }

        console.log('[PROFILE] Cargando likes para usuario:', userId);

        const response = await fetch(`/profile/${userId}/likes`, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error loading liked images: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('La respuesta del servidor no es JSON válido');
        }

        const data = await response.json();
        console.log('[PROFILE] Respuesta de likes:', data);

        if (Array.isArray(data.likes)) {
          this.likedImages = data.likes.map(image => ({
            ...image,
            mainImageUrl: image.mainImageUrl || image.url || '',
            title: image.title || 'Sin título'
          }));
          
          console.log('[PROFILE] Array de likes actualizado:', {
            timestamp: new Date().toISOString(),
            totalLikes: this.likedImages.length,
            likes: this.likedImages,
          });
        } else {
          console.error('Formato de respuesta inválido para likes:', data);
          this.likedImages = [];
        }
      } catch (error) {
        console.error('Error loading liked images:', error);
        window.Toast.fire({
          icon: 'error',
          title: error.message || 'Error al cargar imágenes con like',
        });
        this.likedImages = [];
      } finally {
        this.isLoading = false;
      }
    },

    async loadCollections() {
      try {
        const auth = Alpine.store('auth');
        if (!auth.currentUser) return;

        const response = await fetch(`/profile/${auth.currentUser.uid}/collections`);
        if (!response.ok) throw new Error('Error loading collections');

        const data = await response.json();
        this.collections = data.collections || [];
      } catch (error) {
        console.error('Error loading collections:', error);
        window.Toast.fire({
          icon: 'error',
          title: 'Error loading collections',
        });
      } finally {
        this.isLoading = false;
      }
    },

    openNewCollectionModal() {
      this.showNewCollectionModal = true;
    },

    closeNewCollectionModal() {
      this.showNewCollectionModal = false;
    },

    async handleLikeToggle(imageId) {
      try {
        const response = await fetch(`/images/${imageId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Error toggling like');

        const result = await response.json();
        console.log('[PROFILE] Estado del like cambiado:', {
          imageId,
          liked: result.liked,
          likesCount: result.likesCount,
          timestamp: new Date().toISOString(),
        });

        // Recargar los likes si estamos en la tab de likes
        if (this.activeTab === 'likes') {
          await this.loadLikedImages();
        }
        return result;
      } catch (error) {
        console.error('Error toggling like:', error);
      }
    },

    startEditing() {
      this.isEditing = true;
      this.error = null;
      this.usernameAvailable = true;
    },

    cancelEditing() {
      this.isEditing = false;
      this.error = null;
      this.usernameAvailable = true;
      this.formData = {
        displayName: this.profile.displayName || '',
        username: this.profile.username || '',
        bio: this.profile.bio || '',
        photoFile: null,
        bannerFile: null,
      };
    },

    handleFileChange(event, type) {
      const file = event.target.files[0];
      if (file) {
        if (file.type.startsWith('image/')) {
          if (type === 'photo') {
            this.formData.photoFile = file;
          } else if (type === 'banner') {
            this.formData.bannerFile = file;
          }
          this.error = null;
        } else {
          this.error = 'Por favor selecciona un archivo de imagen válido';
          event.target.value = '';
        }
      }
    },

    async checkUsername(username) {
      if (!username || username === this.profile.username) {
        this.usernameAvailable = true;
        return;
      }

      this.usernameChecking = true;
      try {
        const response = await fetch(
          `/api/profile/check-username?username=${encodeURIComponent(username)}`,
          {
            headers: {
              Accept: 'application/json',
            },
          }
        );

        if (!response.ok) throw new Error('Error al verificar username');

        const data = await response.json();
        this.usernameAvailable = data.available;
      } catch (error) {
        console.error('Error al verificar username:', error);
        this.error = 'Error al verificar disponibilidad del username';
        this.usernameAvailable = false;
      } finally {
        this.usernameChecking = false;
      }
    },

    async saveProfile() {
      if (!this.profile?.uid) {
        console.error('Error: No hay ID de perfil disponible');
        return;
      }

      if (!this.usernameAvailable) {
        this.error = 'El username no está disponible';
        return;
      }

      try {
        this.isLoading = true;
        this.error = null;

        const formData = new FormData();

        // Agregar campos de texto
        if (this.formData.displayName) formData.append('displayName', this.formData.displayName);
        if (this.formData.username) formData.append('username', this.formData.username);
        if (this.formData.bio) formData.append('bio', this.formData.bio);

        // Agregar archivos si existen
        if (this.formData.photoFile) {
          formData.append('photo', this.formData.photoFile);
        }

        if (this.formData.bannerFile) {
          formData.append('banner', this.formData.bannerFile);
        }

        const response = await fetch(`/profile/${this.profile.uid}`, {
          method: 'PUT',
          body: formData,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) throw new Error('Error al actualizar perfil');

        const result = await response.json();

        // Actualizar el perfil local con los datos actualizados
        Object.assign(this.profile, result.profile);

        // Cerrar el modal y limpiar el formulario
        this.isEditing = false;
        this.formData.photoFile = null;
        this.formData.bannerFile = null;

        // Recargar la página para mostrar los cambios
        window.location.reload();
      } catch (error) {
        console.error('Error al guardar perfil:', error);
        this.error = error.message || 'Error al actualizar perfil';
      } finally {
        this.isLoading = false;
      }
    },
  });
});
