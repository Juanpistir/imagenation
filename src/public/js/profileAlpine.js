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
    profile: window.PROFILE_DATA || {
      id: '',
      uid: '',
      email: '',
      username: '',
      displayName: '',
      bio: '',
      photoURL: '',
      bannerURL: '',
      createdAt: null,
      updatedAt: null,
      role: 'user',
      isActive: true,
      images: [],
    },
    formData: {
      displayName: '',
      username: '',
      bio: '',
      photoFile: null,
      bannerFile: null,
    },

    async init() {
      if (this.profile) {
        this.formData = {
          displayName: this.profile.displayName || '',
          username: this.profile.username || '',
          bio: this.profile.bio || '',
          photoFile: null,
          bannerFile: null,
        };

        // Cargar datos iniciales
        await Promise.all([
          this.loadLikedImages(),
          this.loadCollections()
        ]);
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
        this.isLoading = true;
        const response = await fetch(`/profile/${this.profile.username}/likes`);
        if (response.ok) {
          const data = await response.json();
          this.likedImages = Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.error('Error loading liked images:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async loadCollections() {
      try {
        this.isLoading = true;
        const response = await fetch(`/profile/${this.profile.username}/collections`);
        if (response.ok) {
          const data = await response.json();
          this.collections = Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.error('Error loading collections:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async handleLikeToggle(imageId) {
      try {
        const response = await fetch(`/images/${imageId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          // Recargar los likes si estamos en la tab de likes
          if (this.activeTab === 'likes') {
            await this.loadLikedImages();
          }
          return result;
        }
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
          `/profile/check-username?username=${encodeURIComponent(username)}`,
          {
            headers: {
              Accept: 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Error al verificar username');
        }

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

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al actualizar perfil');
        }

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
