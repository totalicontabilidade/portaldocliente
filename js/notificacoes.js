/* ============================================================
   Totali · Portal de Onboarding
   notificacoes.js — avisos ao cliente

   DOIS TIPOS, NÃO CONFUNDIR
   -------------------------
   1) Aviso local (este arquivo, já funcionando): o portal está
      aberto ou em segundo plano no aparelho e dispara o aviso
      sozinho. Não precisa de servidor.

   2) Push de verdade (aplicativo fechado): exige servidor. O
      service worker já tem os ouvintes prontos; falta ligar o
      Firebase Cloud Messaging e guardar a inscrição de cada
      aparelho. Enquanto isso não existir, quem avisa é o item 1.

   LIMITE DO IPHONE
   ----------------
   No iOS, notificação da web só funciona com o portal
   INSTALADO na tela de início (iOS 16.4 ou superior). No
   navegador comum, o iPhone não notifica — nada que a gente
   escreva muda isso. Por isso o portal pede a instalação antes
   de pedir a permissão.
   ============================================================ */
(function (global) {
  "use strict";

  var temAPI = ("Notification" in global);
  var temSW = ("serviceWorker" in navigator);

  function instalado() {
    try {
      return (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches) ||
             navigator.standalone === true;
    } catch (e) { return false; }
  }

  function ehIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  var Notif = {
    get suportado() { return temAPI; },

    get ativo() { return temAPI && Notification.permission === "granted"; },

    /* Por que ainda não dá para avisar — texto pronto para a tela. */
    motivo: function () {
      if (!temAPI) return "Este navegador não envia notificações.";
      if (ehIOS() && !instalado()) {
        return "No iPhone, é preciso instalar o portal na tela de início para receber avisos.";
      }
      if (Notification.permission === "denied") {
        return "Os avisos foram bloqueados. Libere nas configurações do navegador para este site.";
      }
      return "";
    },

    /* Precisa ser chamado a partir de um toque do usuário —
       navegador nenhum aceita pedido automático. */
    pedirPermissao: function () {
      if (!temAPI) return Promise.resolve(false);
      if (Notification.permission === "granted") return Promise.resolve(true);
      if (Notification.permission === "denied") return Promise.resolve(false);
      try {
        var r = Notification.requestPermission();
        if (r && typeof r.then === "function") {
          return r.then(function (p) { return p === "granted"; });
        }
        return new Promise(function (resolve) {
          Notification.requestPermission(function (p) { resolve(p === "granted"); });
        });
      } catch (e) { return Promise.resolve(false); }
    },

    /* Mostra o aviso. Pelo service worker quando possível: é o
       único caminho que funciona com o portal em segundo plano. */
    avisar: function (opcoes) {
      if (!Notif.ativo) return Promise.resolve(false);
      var o = opcoes || {};
      var corpoNotificacao = {
        body: String(o.corpo || ""),
        icon: "assets/icon-192.png",
        badge: "assets/icon-192.png",
        tag: String(o.tag || "totali"),
        renotify: !!o.tag,
        lang: "pt-BR",
        data: { rota: String(o.rota || "inicio") },
        requireInteraction: false
      };
      var titulo = String(o.titulo || "Totali");

      if (temSW && navigator.serviceWorker.ready) {
        return navigator.serviceWorker.ready.then(function (reg) {
          return reg.showNotification(titulo, corpoNotificacao);
        }).then(function () { return true; }, function () { return false; });
      }
      try { new Notification(titulo, corpoNotificacao); return Promise.resolve(true); }
      catch (e) { return Promise.resolve(false); }
    },

    /* Só avisa quando a pessoa NÃO está olhando a tela em questão.
       Evita notificar quem já está lendo a conversa. */
    avisarSeAusente: function (opcoes, rotaAtual) {
      var o = opcoes || {};
      var olhando = !document.hidden && rotaAtual === (o.rota || "");
      if (olhando) return Promise.resolve(false);
      return Notif.avisar(o);
    },

    /* ---- Modelos de aviso ---- */
    novaMensagem: function (autorNome, texto, rotaAtual) {
      return Notif.avisarSeAusente({
        titulo: autorNome ? autorNome + " · Totali" : "Nova mensagem da Totali",
        corpo: texto,
        tag: "mensagem",
        rota: "mensagens"
      }, rotaAtual);
    },

    /* Havia aqui um `documentoSolicitado`, e ninguém o chamava. A
       cobrança de documento sai pela aba Mensagens, e é o
       `novaMensagem` acima que avisa — um aviso só, com o texto que
       a equipe escreveu, em vez de dois dizendo quase o mesmo. */

    documentoRevisado: function (nomeDoDocumento, situacao, rotaAtual) {
      var textos = {
        aprovado: "Aprovado: " + nomeDoDocumento,
        pendencia: "Precisa corrigir: " + nomeDoDocumento,
        analise: "Em análise: " + nomeDoDocumento
      };
      return Notif.avisarSeAusente({
        titulo: "Documento revisado",
        corpo: textos[situacao] || nomeDoDocumento,
        tag: "revisao",
        rota: "documentos"
      }, rotaAtual);
    },

    /* O combinado do "Enviar depois" chegou ao dia.

       Este é o único aviso que a própria pessoa pediu — os outros
       partem da Totali. Por isso o texto lembra disso ("você
       marcou"), em vez de soar como cobrança. */
    lembreteDoCliente: function (nomeDoDocumento, quantos, rotaAtual) {
      return Notif.avisarSeAusente({
        titulo: quantos > 1 ? "Você marcou " + quantos + " documentos para hoje"
                            : "Você marcou este documento para hoje",
        corpo: quantos > 1
          ? nomeDoDocumento + " e mais " + (quantos - 1)
          : nomeDoDocumento,
        tag: "lembrete",
        rota: "documentos"
      }, rotaAtual);
    }
  };

  /* AVISO COM O APLICATIVO FECHADO — ainda não existe, e não há
     função de mentira aqui fingindo que existe. Havia uma
     `registrarNoServidor` que só devolvia `null` e que ninguém
     chamava; um método que não faz nada é pior do que método
     nenhum, porque parece pronto.

     Quando o Cloud Messaging entrar, é aqui que a inscrição do
     aparelho será obtida e mandada ao servidor. Dois detalhes que
     se descobrem tarde: a CSP precisa liberar o domínio do Firebase
     em `connect-src`, e o manifesto precisa do `gcm_sender_id`.
     Os ouvintes `push` e `notificationclick` já estão no sw.js. */

  global.Notif = Notif;
})(window);
