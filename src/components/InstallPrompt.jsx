import { useEffect, useState } from 'react';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferred(e);
    }
    function onAppInstalled() {
      setDeferred(null);
      setInstalled(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  async function install() {
    // o evento só pode ser usado uma vez — some com o botão em qualquer desfecho
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch { /* prompt recusado ou indisponível */ }
    setDeferred(null);
  }

  return (
    <div className="install-panel">
      <span>
        Instale o app na tela inicial: abre em tela cheia, com ícone próprio e funciona offline.
      </span>
      <button className="install-btn" onClick={install}>⬇ Instalar app</button>
    </div>
  );
}
