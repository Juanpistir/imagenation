// Usar Firebase compat API
const auth = firebase.auth();
let currentUser = null;

// Manejar estado de autenticación
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
        const idToken = await user.getIdToken();
        // Enviar el token al servidor para establecer la cookie
        await sendTokenToServer(idToken);
        updateUIForUser(user);
    } else {
        await sendTokenToServer(''); // Eliminar el token en el servidor
        updateUIForGuest();
    }
});

// Funciones de autenticación
async function login(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
        // El token se enviará automáticamente a través de onAuthStateChanged
    } catch (error) {
        console.error('Error en login:', error);
        throw error;
    }
}

async function register(username, email, password) {
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        await auth.currentUser.updateProfile({ displayName: username });
        // El token se enviará automáticamente a través de onAuthStateChanged
    } catch (error) {
        console.error('Error en registro:', error);
        throw error;
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        await auth.signOut();
        window.location.href = '/login';
    } catch (error) {
        console.error('Error en logout:', error);
    }
}

// Iniciar sesión con Google
async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        // El token se enviará automáticamente a través de onAuthStateChanged
    } catch (error) {
        console.error('Error en login con Google:', error);
        throw error;
    }
}

// Enviar el token al servidor para establecer la cookie
async function sendTokenToServer(token) {
    try {
        if (token) {
            await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Incluir credenciales
                body: JSON.stringify({ idToken: token })
            });
        } else {
            // Eliminar la cookie en el servidor enviando token vacío
            await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ idToken: '' })
            });
        }
    } catch (error) {
        console.error('Error al enviar token al servidor:', error);
    }
}

// Actualizar UI basado en estado de autenticación
function updateUIForUser(user) {
    document.querySelectorAll('.auth-user').forEach(el => el.style.display = 'block');
    document.querySelectorAll('.auth-guest').forEach(el => el.style.display = 'none');
}

function updateUIForGuest() {
    document.querySelectorAll('.auth-user').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.auth-guest').forEach(el => el.style.display = 'block');
}

// Interceptor para tokens (opcional, si necesitas autenticar solicitudes adicionales)
function setupTokenInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [resource, config = {}] = args;

        if (currentUser) {
            const token = await currentUser.getIdToken(true);
            config.headers = {
                ...config.headers,
                'Authorization': `Bearer ${token}`
            };
        }

        return originalFetch(resource, config);
    };
}

// Inicialización
setupTokenInterceptor();

window.loginWithGoogle = loginWithGoogle;
window.login = login;
window.register = register;
window.logout = logout;