// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBM7ltd823a-xacz4YzKCN7n-HfFU6rHCc",
    authDomain: "imagenation-node.firebaseapp.com",
    projectId: "imagenation-node",
    storageBucket: "imagenation-node.appspot.com",
    messagingSenderId: "679409973529",
    appId: "1:679409973529:web:29aa0ac3a5dca2f2da6d88"
};

// Funciones de UI globales
window.updateUIForUser = function(user) {
    console.log('🔄 Actualizando UI para usuario:', user.email);
    document.querySelectorAll('[data-auth="logged-in"]').forEach(el => {
        el.style.display = 'block';
    });
    document.querySelectorAll('[data-auth="logged-out"]').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('[data-user-info="email"]').forEach(el => {
        el.textContent = user.email;
    });
};

window.updateUIForGuest = function() {
    console.log('🔄 Actualizando UI para invitado');
    document.querySelectorAll('[data-auth="logged-in"]').forEach(el => {
        el.style.display = 'none';
    });
    document.querySelectorAll('[data-auth="logged-out"]').forEach(el => {
        el.style.display = 'block';
    });
    document.querySelectorAll('[data-user-info="email"]').forEach(el => {
        el.textContent = '';
    });
};

// Inicializar Firebase
try {
    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);
    
    // Configurar persistencia de autenticación
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            console.log('✅ Persistencia configurada correctamente');
            
            // Verificar si hay una sesión activa
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    console.log('✅ Sesión activa detectada:', user.email);
                    user.getIdToken()
                        .then(token => {
                            if (window.auth) {
                                window.auth.currentUser = user;
                                window.auth.token = token;
                                window.auth.isInitialized = true;
                                window.updateUIForUser(user);
                            }
                        })
                        .catch(error => {
                            console.error('❌ Error obteniendo token:', error);
                            window.updateUIForGuest();
                        });
                } else {
                    console.log('ℹ️ No hay sesión activa');
                    if (window.auth) {
                        window.auth.currentUser = null;
                        window.auth.token = null;
                        window.auth.isInitialized = true;
                    }
                    window.updateUIForGuest();
                }
            });
        })
        .catch((error) => {
            console.error('❌ Error configurando persistencia:', error);
        });
    
    console.log('✅ Firebase inicializado correctamente');
} catch (error) {
    console.error('❌ Error al inicializar Firebase:', error);
}
