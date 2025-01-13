// Variables de estado
let currentUser = null;
let authStateInitialized = false;

// Obtener la instancia de Firebase Auth
const auth = firebase.auth();

// Funciones de autenticación
const authManager = {
    currentUser: null,
    token: null,
    isInitialized: false,

    // Iniciar sesión
    async login(email, password) {
        try {
            console.log(' [LOGIN] Iniciando sesión...');
            
            // Iniciar sesión con Firebase
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log(' [LOGIN] Sesión iniciada en Firebase');

            // Obtener token
            const token = await user.getIdToken();
            console.log(' [LOGIN] Token obtenido');

            // Actualizar estado global
            this.currentUser = user;
            this.token = token;
            this.isInitialized = true;

            // Actualizar UI
            window.updateUIForUser(user);
            
            // Mostrar mensaje de bienvenida
            Swal.fire({
                icon: 'success',
                title: '¡Bienvenido/a!',
                text: `Has iniciado sesión como ${user.email}`,
                showConfirmButton: false,
                timer: 2000
            });

            // Redirigir a la página principal
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);

            return true;
        } catch (error) {
            console.error(' [LOGIN] Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al iniciar sesión',
                text: error.message
            });
            return false;
        }
    },

    // Registrar usuario
    async register(email, password, name) {
        try {
            console.log(' [REGISTER] Iniciando registro...');
            
            // Registrar en el servidor
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, name })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Error en el registro');
            }

            console.log(' [REGISTER] Usuario registrado en el servidor');

            // Iniciar sesión automáticamente
            return await this.login(email, password);
        } catch (error) {
            console.error(' [REGISTER] Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error en el registro',
                text: error.message
            });
            return false;
        }
    },

    // Cerrar sesión
    async logout() {
        try {
            console.log(' [LOGOUT] Cerrando sesión...');

            // Cerrar sesión en Firebase
            await firebase.auth().signOut();
            console.log(' [LOGOUT] Sesión cerrada');

            // Limpiar estado
            this.currentUser = null;
            this.token = null;
            this.isInitialized = false;

            // Actualizar UI
            window.updateUIForGuest();

            // Redirigir a la página de login
            window.location.href = '/login';

            return true;
        } catch (error) {
            console.error(' [LOGOUT] Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al cerrar sesión',
                text: error.message
            });
            return false;
        }
    },

    // Verificar estado de autenticación
    async checkAuth() {
        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                return false;
            }

            const token = await user.getIdToken();
            this.token = token;
            return true;
        } catch (error) {
            console.error(' [CHECK] Error verificando autenticación:', error);
            return false;
        }
    }
};

// Asignar el objeto auth a window inmediatamente
window.auth = authManager;

// Inicializar la configuración de autenticación
function initializeAuth() {
    // Función para actualizar la UI cuando hay un usuario autenticado
    function updateUIForUser(user) {
        console.log(' Actualizando UI para usuario:', user.email);
        
        // Actualizar elementos de la UI
        document.querySelectorAll('[data-auth="logged-in"]').forEach(el => {
            el.style.display = 'block';
        });
        document.querySelectorAll('[data-auth="logged-out"]').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('[data-user-info="email"]').forEach(el => {
            el.textContent = user.email;
        });
    }

    // Función para actualizar la UI cuando no hay usuario
    function updateUIForGuest() {
        console.log(' Actualizando UI para invitado');
        
        // Actualizar elementos de la UI
        document.querySelectorAll('[data-auth="logged-in"]').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('[data-auth="logged-out"]').forEach(el => {
            el.style.display = 'block';
        });
        document.querySelectorAll('[data-user-info="email"]').forEach(el => {
            el.textContent = '';
        });
    }

    // Escuchar cambios en el estado de autenticación
    let authInitialized = false;
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!authInitialized) {
            authInitialized = true;
            window.auth.isInitialized = true;
        }

        window.auth.currentUser = user;
        
        if (user) {
            try {
                console.log('Usuario autenticado:', user.email);
                const token = await user.getIdToken();
                window.defaultHeaders = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                };
                
                // Actualizar la UI
                window.updateUIForUser(user);
                
                // Verificar si estamos en la página de login y redirigir si es necesario
                if (window.location.pathname === '/login') {
                    window.location.href = '/';
                }
            } catch (error) {
                console.error('Error al obtener token:', error);
                window.updateUIForGuest();
            }
        } else {
            console.log('No hay usuario autenticado');
            window.defaultHeaders = {
                'Content-Type': 'application/json'
            };
            window.updateUIForGuest();
            
            // Si no hay usuario y estamos en una página protegida, redirigir al login
            if (localStorage.getItem('isLoggedIn') === 'true') {
                localStorage.removeItem('isLoggedIn');
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
        }
    });

    // Interceptor para las peticiones fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        try {
            // Si hay un token y es una petición a nuestra API, agregar el token
            if (window.auth?.token && (args[0].startsWith('/api/') || args[0].startsWith('http://localhost'))) {
                const options = args[1] || {};
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${window.auth.token}`
                };
                args[1] = options;
            }
            return await originalFetch.apply(this, args);
        } catch (error) {
            console.error('Error en fetch interceptor:', error);
            throw error;
        }
    };
}

// Inicializar autenticación cuando se carga la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
    initializeAuth();
}