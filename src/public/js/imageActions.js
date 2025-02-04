// Alpine.js component for image actions
document.addEventListener('alpine:init', () => {
  Alpine.data('imageActions', (imageId) => ({
    showCollectionModal: false,
    showCommentSection: false,
    isLiked: false,
    likesCount: 0,
    collections: [],
    comments: [],
    commentText: '',
    isLoading: false,
    newCollectionName: '',
    newCollectionDescription: '',
    imageError: false,
    userCollections: [],
    showCreateForm: false,

    init() {
      this.showCollectionModal = false;
      // Inicializar datos desde window.IMAGE_DATA
      if (window.IMAGE_DATA) {
        this.isLiked = window.IMAGE_DATA.hasLiked;
        this.likesCount = window.IMAGE_DATA.likes;
        this.comments = window.IMAGE_DATA.comments || [];
      }

      // Observar cambios en la autenticación
      this.$watch('$store.auth.isAuthenticated', (isAuthenticated) => {
        if (isAuthenticated) {
          this.loadImageData();
        }
      });

      // Cargar datos si ya está autenticado
      if (Alpine.store('auth').isAuthenticated) {
        this.loadImageData();
      }
    },

    async loadImageData() {
      try {
        const auth = Alpine.store('auth');
        const userId = auth.currentUser?.uid;

        const response = await fetch(`/api/images/${imageId}`);
        if (!response.ok) throw new Error('Error loading image');
        const data = await response.json();

        // Actualizar estado solo si hay usuario autenticado
        if (userId) {
          this.isLiked = data.likes?.includes(userId);
          this.collections = data.collections || [];
        }

        this.likesCount = data.likesCount || 0;
        
        // Asegurarse de que los timestamps sean válidos
        if (data.comments) {
          this.comments = data.comments.map(comment => {
            // Solo actualizar el timestamp si es necesario
            if (comment.timestamp && typeof comment.timestamp === 'string') {
              return {
                ...comment,
                timestamp: new Date(comment.timestamp).toISOString()
              };
            }
            return comment;
          });
        } else {
          this.comments = [];
        }
      } catch (error) {
        console.error('Error loading image data:', error);
        this.imageError = true;
      }
    },

    async toggleLike() {
      if (!Alpine.store('auth').isAuthenticated) {
        window.Toast.fire({
          icon: 'error',
          title: 'Debes iniciar sesión para dar like',
        });
        return;
      }

      try {
        this.isLoading = true;
        const response = await fetch(`/api/images/${imageId}/like`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (!response.ok) throw new Error('Error al dar like');
        const data = await response.json();

        this.likesCount = data.likesCount;
        this.isLiked = data.hasLiked;
      } catch (error) {
        console.error('Error toggling like:', error);
        window.Toast.fire({
          icon: 'error',
          title: 'Error al dar like',
        });
      } finally {
        this.isLoading = false;
      }
    },

    async openCollectionModal() {
      console.log('Abriendo modal de colecciones');
      if (!Alpine.store('auth').isAuthenticated) {
        window.Toast.fire({
          icon: 'error',
          title: 'Debes iniciar sesión para guardar en colecciones',
        });
        return;
      }

      try {
        this.showCollectionModal = true;
        console.log('Estado del modal:', this.showCollectionModal);
        await this.fetchUserCollections();
      } catch (error) {
        console.error('Error al abrir el modal:', error);
      }
    },

    closeCollectionModal() {
      console.log('Cerrando modal de colecciones');
      this.showCollectionModal = false;
      this.showCreateForm = false;
    },

    async fetchUserCollections() {
      console.log('Obteniendo colecciones del usuario');
      try {
        const response = await fetch('/api/collections');
        if (!response.ok) throw new Error('Error fetching collections');

        const collections = await response.json();
        console.log('Colecciones obtenidas:', collections);
        this.userCollections = collections;
      } catch (error) {
        console.error('Error al obtener colecciones:', error);
      }
    },

    focusComment() {
      const auth = Alpine.store('auth');
      const userId = auth.currentUser?.uid;

      if (!userId) {
        window.Toast.fire({
          icon: 'error',
          title: 'Please log in to comment',
        });
        return;
      }
      this.showCommentSection = true;
      setTimeout(() => {
        document.getElementById('commentInput')?.focus();
      }, 100);
    },

    async submitComment() {
      if (!this.commentText.trim()) return;

      try {
        const auth = Alpine.store('auth');
        const userId = auth.currentUser?.uid;

        if (!userId) {
          window.Toast.fire({
            icon: 'error',
            title: 'Please log in to comment',
          });
          return;
        }

        const response = await fetch(`/images/${imageId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: this.commentText }),
        });

        if (!response.ok) throw new Error('Failed to submit comment');

        this.commentText = '';
        await this.loadImageData();

        window.Toast.fire({
          icon: 'success',
          title: 'Comment added successfully',
        });
      } catch (error) {
        console.error('Error submitting comment:', error);
        window.Toast.fire({
          icon: 'error',
          title: 'Error adding comment',
        });
      }
    },

    async shareImage() {
      try {
        const shareData = {
          title: 'Check out this image on Imagenation',
          text: 'I found this amazing image on Imagenation!',
          url: window.location.href,
        };

        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(window.location.href);
          window.Toast.fire({
            icon: 'success',
            title: 'Link copied to clipboard!',
          });
        }
      } catch (error) {
        console.error('Error sharing image:', error);
        window.Toast.fire({
          icon: 'error',
          title: 'Error sharing image',
        });
      }
    },

    async addToCollection(collectionId) {
      try {
        if (!Alpine.store('auth').isAuthenticated) {
          window.Toast.fire({
            icon: 'error',
            title: 'Please log in to add to collections',
          });
          return;
        }

        const response = await fetch(`/api/collections/${collectionId}/images/${imageId}`, {
          method: 'POST',
        });

        if (!response.ok) throw new Error('Failed to add to collection');

        window.Toast.fire({
          icon: 'success',
          title: 'Added to collection!',
        });

        this.showCollectionModal = false;
      } catch (error) {
        console.error('Error adding to collection:', error);
        window.Toast.fire({
          icon: 'error',
          title: error.message,
        });
      }
    },

    async createCollection() {
      console.log('Creando nueva colección:', {
        name: this.newCollectionName,
        description: this.newCollectionDescription,
      });

      try {
        const response = await fetch('/api/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: this.newCollectionName,
            description: this.newCollectionDescription,
          }),
        });

        if (!response.ok) throw new Error('Error creating collection');

        const newCollection = await response.json();
        console.log('Colección creada:', newCollection);

        await this.fetchUserCollections();
        this.showCreateForm = false;
        this.newCollectionName = '';
        this.newCollectionDescription = '';
        window.Toast.fire({ icon: 'success', title: 'Colección creada exitosamente' });
      } catch (error) {
        console.error('Error al crear colección:', error);
        window.Toast.fire({ icon: 'error', title: 'Error al crear la colección' });
      }
    },
  }));
});
