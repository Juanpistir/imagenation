document.addEventListener('alpine:init', () => {
  Alpine.store('search', {
    isSearching: false,
    searchQuery: '',
    searchResults: [],
    searchTimeout: null,
    isSpinning: false,
    minChars: 3,

    init() {
      this.resetSearch();
    },

    executeSearch() {
      if (this.searchQuery.length < this.minChars) {
        this.resetSearch();
        return;
      }

      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

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
      }, 500);
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
      Toast.fire({
        icon: 'error',
        title: 'Error al realizar la búsqueda',
        text: 'Por favor, intenta de nuevo más tarde',
      });
    },
  });
});
