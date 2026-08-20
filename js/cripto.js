/* ============================================================
   Totali · Portal de Onboarding
   cripto.js — proteção das credenciais enviadas pelo cliente

   COMO FUNCIONA
   -------------
   O cliente digita a senha; ela é cifrada AQUI, no aparelho
   dele, antes de ser guardada ou enviada. O portal só conhece a
   CHAVE PÚBLICA da Totali — com ela dá para trancar, não para
   abrir. Quem abre é a chave privada, que fica no Secret Manager
   do projeto e nunca chega a navegador nenhum.

   Envelope em duas camadas, que é o padrão para isso:
     1. sorteia uma chave AES-GCM de 256 bits, só para este envio
     2. cifra os dados com ela
     3. tranca essa chave AES com a RSA-OAEP pública da Totali

   Consequência prática: mesmo quem tiver acesso ao banco de
   dados, ao backup ou ao aparelho do cliente vê apenas texto
   embaralhado. Sem a chave privada, não há o que ler.

   QUEM ABRE, E COMO — mudou em 20/08/2026
   ---------------------------------------
   Antes, abrir exigia o ARQUIVO da chave privada, e só uma
   pessoa o tinha. Na prática isso empurrava a equipe para o pior
   caminho possível: print da senha indo para o WhatsApp.

   Hoje a chave mora no Secret Manager e quem abre é a Cloud
   Function "abrirCredencial", para qualquer membro da equipe — e
   cada abertura vira registro em /auditoria, com nome e hora.

   O painel manda no pedido uma chave pública descartável, gerada
   na memória daquela aba, e a função recifra a resposta com ela.
   Assim, no Firestore, nem o pedido nem a resposta têm senha
   legível.

   O PREÇO DISSO, que precisa estar claro:
     • a chave privada continua sendo a única forma de ler.
       Perdeu, perdeu. Mantenha a cópia em cofre de senhas mesmo
       depois de subir para o Secret Manager.
     • o servidor passa a poder abrir. É menos hermético que
       antes, e foi decisão consciente: são senhas de LEITURA DE
       RELATÓRIO, e o acesso da equipe inteira vale mais do que
       uma hermeticidade que ninguém conseguia usar.

   Gere o par em equipe.html → "Gerar par de chaves".
   ============================================================ */
(function (global) {
  "use strict";

  var subtle = (global.crypto && global.crypto.subtle) ? global.crypto.subtle : null;
  var VERSAO = 1;
  var ALG = "RSA-OAEP-256+AES-GCM-256";

  /* ---------- Conversões ---------- */
  function paraB64(buf) {
    var bytes = new Uint8Array(buf), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function deB64(s) {
    var bin = atob(String(s || ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function importarPublica(jwk) {
    return subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  }
  function importarPrivada(jwk) {
    return subtle.importKey("jwk", jwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  }

  var Cripto = {
    get disponivel() { return !!subtle; },

    /* Há chave pública configurada neste portal? */
    get configurada() {
      var c = global.CHAVE_PUBLICA;
      return !!(subtle && c && typeof c === "object" && c.kty === "RSA" && c.n);
    },

    motivo: function () {
      if (!subtle) {
        return "Este navegador não tem os recursos de criptografia necessários. " +
               "Atualize o navegador ou fale com a Totali.";
      }
      if (!Cripto.configurada) {
        return "O canal seguro ainda não foi configurado. Fale com a Totali antes de enviar senhas.";
      }
      return "";
    },

    /* ---------- Gerar o par (uso interno da Totali) ---------- */
    gerarPar: function () {
      if (!subtle) return Promise.reject(new Error("Sem suporte a criptografia"));
      return subtle.generateKey({
        name: "RSA-OAEP",
        modulusLength: 3072,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      }, true, ["encrypt", "decrypt"]).then(function (par) {
        return Promise.all([
          subtle.exportKey("jwk", par.publicKey),
          subtle.exportKey("jwk", par.privateKey)
        ]).then(function (r) {
          return { publica: r[0], privada: r[1] };
        });
      });
    },

    /* ---------- Cifrar (no aparelho do cliente) ---------- */
    cifrar: function (objeto) {
      if (!Cripto.configurada) return Promise.reject(new Error("canal-nao-configurado"));

      var texto = JSON.stringify(objeto);
      var dados = new TextEncoder().encode(texto);
      var iv = global.crypto.getRandomValues(new Uint8Array(12));
      var chaveAES;

      return subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"])
        .then(function (k) {
          chaveAES = k;
          return subtle.encrypt({ name: "AES-GCM", iv: iv }, k, dados);
        })
        .then(function (cifrado) {
          return subtle.exportKey("raw", chaveAES).then(function (bruta) {
            return importarPublica(global.CHAVE_PUBLICA).then(function (pub) {
              return subtle.encrypt({ name: "RSA-OAEP" }, pub, bruta).then(function (chaveTrancada) {
                return {
                  v: VERSAO,
                  alg: ALG,
                  iv: paraB64(iv),
                  chave: paraB64(chaveTrancada),
                  dados: paraB64(cifrado),
                  em: Date.now()
                };
              });
            });
          });
        });
    },

    /* ---------- Decifrar (painel da Totali, com a chave privada) ---------- */
    decifrar: function (pacote, chavePrivadaJwk) {
      if (!subtle) return Promise.reject(new Error("Sem suporte a criptografia"));
      if (!pacote || pacote.alg !== ALG) return Promise.reject(new Error("Pacote desconhecido"));

      return importarPrivada(chavePrivadaJwk).then(function (priv) {
        return subtle.decrypt({ name: "RSA-OAEP" }, priv, deB64(pacote.chave));
      }).then(function (bruta) {
        return subtle.importKey("raw", bruta, { name: "AES-GCM" }, false, ["decrypt"]);
      }).then(function (chaveAES) {
        return subtle.decrypt({ name: "AES-GCM", iv: deB64(pacote.iv) }, chaveAES, deB64(pacote.dados));
      }).then(function (aberto) {
        return JSON.parse(new TextDecoder().decode(aberto));
      });
    },

    /* Impressão digital da chave pública, para conferir que o
       portal e o painel estão com o mesmo par. */
    impressaoDigital: function (jwk) {
      if (!subtle || !jwk || !jwk.n) return Promise.resolve("");
      var dados = new TextEncoder().encode(jwk.n);
      return subtle.digest("SHA-256", dados).then(function (h) {
        var b = new Uint8Array(h), s = "";
        for (var i = 0; i < 8; i++) s += (b[i] + 0x100).toString(16).slice(1);
        return s.toUpperCase().replace(/(.{4})/g, "$1 ").trim();
      });
    }
  };

  global.Cripto = Cripto;
})(window);
