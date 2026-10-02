import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, Smartphone, X, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ModalSeguridad2FA({ onClose }) {
    const [qrUri, setQrUri] = useState('');
    const [claveManual, setClaveManual] = useState('');
    const [codigo, setCodigo] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState('');
    const [exito, setExito] = useState(false);

    useEffect(() => {
        async function cargarConfiguracion() {
            try {
                const token = localStorage.getItem('token_jwt');
                const res = await fetch('/api/Auth/2fa-configurar', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('No se pudo cargar la configuración de seguridad.');

                const data = await res.json();
                setQrUri(data.uriCodigoQr);
                setClaveManual(data.claveManual);
            } catch (err) {
                setError(err.message);
            }
        }
        cargarConfiguracion();
    }, []);

    const activar2FA = async (e) => {
        e.preventDefault();
        setError('');
        setMensaje('');

        try {
            const token = localStorage.getItem('token_jwt');
            const res = await fetch('/api/Auth/2fa-activar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ codigo6Digitos: codigo })
            });

            if (!res.ok) {
                const errData = await res.text();
                throw new Error(errData || 'El código ingresado es incorrecto o ya expiró.');
            }

            setExito(true);
            setMensaje('¡Autenticador vinculado exitosamente!');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '450px', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>

                <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                    <X size={24} />
                </button>

                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <ShieldCheck size={48} color={exito ? "#10b981" : "#3b82f6"} style={{ margin: '0 auto' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0 0.5rem', color: '#1f2937' }}>
                        Seguridad en 2 Pasos
                    </h2>
                    <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                        Protege tu cuenta de Aula Norte con Microsoft Authenticator.
                    </p>
                </div>

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        <AlertTriangle size={18} /> {error}
                    </div>
                )}

                {exito ? (
                    <div style={{ textAlign: 'center', backgroundColor: '#ecfdf5', padding: '1.5rem', borderRadius: '0.5rem', color: '#047857' }}>
                        <CheckCircle size={32} style={{ margin: '0 auto 1rem' }} />
                        <p style={{ fontWeight: 'bold' }}>{mensaje}</p>
                        <button onClick={onClose} style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>
                            Cerrar y continuar
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                            {qrUri ? <QRCodeSVG value={qrUri} size={180} level="M" includeMargin={true} /> : <div style={{ height: 180, display: 'flex', alignItems: 'center' }}>Cargando QR...</div>}
                        </div>

                        <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem', textAlign: 'center' }}>
                            Abre la app, escanea el código QR e ingresa los 6 dígitos generados.
                        </p>

                        <form onSubmit={activar2FA}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Smartphone size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                                    <input
                                        type="text"
                                        maxLength="6"
                                        placeholder="000000"
                                        value={codigo}
                                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} // Solo permite números
                                        style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1.1rem', letterSpacing: '2px', textAlign: 'center', boxSizing: 'border-box', outline: 'none' }}
                                        required
                                    />
                                </div>
                                <button type="submit" style={{ backgroundColor: '#2563eb', color: 'white', padding: '0 1.5rem', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                                    Verificar
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}