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
              user,
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
              isAuthenticated: true,
            }
          : null;

        // Debug de autenticación
        console.log('Estado de autenticación actualizado:', {
          currentUser: this.currentUser?.uid,
          userData: this.userData,
          isAuthenticated: !!user,
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

    handleAuthError(error, redirectPath = '/') {
      console.error('Error de autenticación:', error);
      const friendlyError = this.getFriendlyError(error.code);
      this.error = friendlyError;
      Toast.fire({
        icon: 'error',
        title: friendlyError,
      });
      if (redirectPath) {
        setTimeout(() => (window.location.href = redirectPath), 1500);
      }
    },

    getFriendlyError(code) {
      const errorMessages = {
        'auth/invalid-email': 'El correo electrónico no es válido',
        'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
        'auth/user-not-found': 'No existe una cuenta con este correo',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/email-already-in-use': 'Este correo ya está registrado',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
        'auth/operation-not-allowed': 'Operación no permitida',
        'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde',
      };
      return errorMessages[code] || 'Error de autenticación desconocido';
    },
  });
});
