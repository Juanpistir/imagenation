document.addEventListener('alpine:init', () => {
  console.log('Datos disponibles al inicializar:', {
    windowProfileData: window.PROFILE_DATA,
    documentReady: document.readyState,
  });

  Alpine.store('profile', {
    isEditing: false,
    isLoading: false,
    error: null,
    profile: window.PROFILE_DATA || {
      id: '',
      uid: '',
      email: '',
      username: '',
      displayName: '',
      bio: '',
      photoURL: '',
      createdAt: null,
      updatedAt: null,
      role: 'user',
      isActive: true,
      images: [],
    },
    formData: {
      displayName: '',
      bio: '',
      photoFile: null,
    },

    init() {
      console.log('Inicializando profile store con datos:', {
        profile: this.profile,
        hasId: Boolean(this.profile?.id || this.profile?.uid),
        fields: Object.keys(this.profile || {}),
      });

      // Usar los campos correctos del perfil
      if (this.profile) {
        this.formData = {
          displayName: this.profile.displayName || '',
          bio: this.profile.bio || '',
          photoFile: null,
        };
        console.log('FormData inicializado con:', this.formData);
      }
    },

    startEditing() {
      this.isEditing = true;
      this.error = null;
    },

    cancelEditing() {
      this.isEditing = false;
      this.error = null;
      // Restaurar los valores originales
      this.formData.displayName = this.profile.displayName || '';
      this.formData.bio = this.profile.bio || '';
      this.formData.photoFile = null;
    },

    handlePhotoChange(event) {
      const file = event.target.files[0];
      if (file) {
        if (file.type.startsWith('image/')) {
          this.formData.photoFile = file;
          this.error = null;
        } else {
          this.error = 'Por favor selecciona un archivo de imagen válido';
          event.target.value = ''; // Limpiar el input
        }
      }
    },

    async saveProfile() {
      console.log('Intentando guardar perfil:', {
        profileId: this.profile?.id,
        formData: this.formData,
      });

      if (!this.profile?.id) {
        console.error('Error: No hay ID de perfil disponible', {
          profile: this.profile,
          windowProfileData: window.PROFILE_DATA,
        });
        return;
      }

      try {
        this.isLoading = true;
        this.error = null;

        const formData = new FormData();
        formData.append('displayName', this.formData.displayName);
        formData.append('bio', this.formData.bio);

        if (this.formData.photoFile) {
          formData.append('photo', this.formData.photoFile);
        }

        console.log('Enviando request a:', `/profile/${this.profile.id}`);

        const response = await fetch(`/profile/${this.profile.id}`, {
          method: 'PUT',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(errorData || 'Error al actualizar el perfil');
        }

        const data = await response.json();
        console.log('Respuesta del servidor:', data);

        // Actualizar el perfil local con los nuevos datos
        this.profile = {
          ...this.profile,
          ...data.updates,
        };
        console.log('Perfil actualizado:', this.profile);

        this.isEditing = false;
        Toast.fire({
          icon: 'success',
          title: 'Perfil actualizado exitosamente',
        });
      } catch (error) {
        console.error('Error en saveProfile:', error);
        this.error = error.message;
        Toast.fire({
          icon: 'error',
          title: this.error,
        });
      } finally {
        this.isLoading = false;
      }
    },
  });
});
