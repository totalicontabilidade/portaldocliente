/* ============================================================
   Totali · Portal do Cliente
   tour.js — tutorial guiado, passo a passo

   Trazido do Academy (motor) com roteiros novos para este portal.
   Regras: um passo mostra um lugar só; dá para sair a qualquer
   momento e rever depois (Perfil › Rever tutorial); se o elemento
   não existir naquela tela, o passo é pulado em silêncio.
   Cada roteiro roda uma vez por pessoa (lembrado no aparelho).
   ============================================================ */
(function (global) {
  "use strict";
  var U = global.U, UI = global.UI, ic = global.ic;
  var CHAVE = "totali-portal-tours";
  var ROTEIROS = {
    "portal-inicio": [
      { titulo: "Bem-vindo ao seu portal", texto: "Aqui você fala com a Totali, envia documentos e acompanha sua empresa. Vamos mostrar onde fica cada coisa. Leva 30 segundos." },
      { alvo: ".card[style*='border-left']", titulo: "O que importa hoje", texto: "Este cartão sempre mostra a coisa mais importante do dia: uma correção, uma mensagem nova ou o próximo passo. Toque nele e pronto." },
      { alvo: ".grade--4", titulo: "As quatro ações", texto: "Chat, Arquivos, Checklist e Sistemas. Tudo o que você faz no portal começa por um destes quatro." },
      { alvo: ".tabbar, .sidebar__in", titulo: "O menu", texto: "No celular o menu fica embaixo; no computador, à esquerda. O botão Menu abre o restante: cofre de senhas, agenda, ajuda." },
      { alvo: "#bannerInicio, .sidebar__banner", titulo: "Sistemas da Totali", texto: "Aqui aparecem sistemas que podem ajudar a sua empresa. Se não interessar, toque em \"Agora não\" e ele some por duas semanas." },
      { titulo: "Pronto", texto: "Qualquer dúvida, o chat responde em horário comercial. Para rever este tutorial: Perfil › Rever tutorial." }
    ],
    "portal-entrada": [
      { titulo: "Lista de documentos", texto: "Esta lista tem tudo o que precisamos para assumir sua contabilidade. A maior parte vem da sua contabilidade anterior; você envia só o que é seu." },
      { alvo: "details.card", titulo: "Por departamento", texto: "Cada bloco é um departamento. Toque para abrir. O contador mostra quantos itens já chegaram." },
      { alvo: ".passo .btn--primario", titulo: "Enviar, informar ou guardar", texto: "Cada item tem um botão: Enviar (arquivo ou foto), Informar (um dado) ou Informar acesso (senha, embaralhada no seu aparelho)." },
      { alvo: "[data-acao='item-na']", titulo: "Não se aplica", texto: "Se um item não faz sentido para a sua empresa, marque \"Não se aplica\". Ele sai da conta e ninguém vai cobrar." }
    ],
    "painel-inicio": [
      { titulo: "Painel da equipe", texto: "Este painel alimenta o portal do cliente. A tela inicial cruza tudo em ordem de urgência: quem escreveu, o que falta conferir, qual jornada atrasou." },
      { alvo: ".grade--4", titulo: "Os números do dia", texto: "Mensagens sem resposta, documentos a conferir, jornadas com atraso e clientes ativos. Toque em um para ir direto." },
      { alvo: ".sidebar__destaque", titulo: "Novo cliente", texto: "Cadastro em um minuto: razão social, CNPJ, trilha. Sai com o convite pronto para o WhatsApp e o D0 da jornada marcado." },
      { alvo: ".topbar__busca", titulo: "Buscar", texto: "Ctrl+K abre a busca: cliente, CNPJ ou tela." }
    ]
  };
  var atual = null;
  function vistos() { try { return JSON.parse(localStorage.getItem(CHAVE) || "{}"); } catch (e) { return {}; } }
  function marcar(id) { var v = vistos(); v[id] = Date.now(); try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (e) {} }
  function alvoDe(sel) { if (!sel) return null; var n; try { n = document.querySelector(sel); } catch (e) { return null; } if (!n) return null; var r = n.getBoundingClientRect(); return (r.width || r.height) ? n : null; }

  function iniciar(id, forcar) {
    var passos = (ROTEIROS[id] || []).filter(function (p) { return !p.alvo || alvoDe(p.alvo); });
    if (!passos.length || atual) return;
    if (!forcar && vistos()[id]) return;
    if (global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches && !forcar) { marcar(id); return; }
    var caixa = document.createElement("div"); caixa.className = "tour"; caixa.setAttribute("role", "dialog"); caixa.setAttribute("aria-modal", "true");
    caixa.innerHTML = '<div class="tour__fundo"></div><div class="tour__spot" hidden></div><div class="tour__balao"></div>';
    document.body.appendChild(caixa); document.body.classList.add("tour-aberto");
    atual = { id: id, passos: passos, i: 0, caixa: caixa, spot: caixa.querySelector(".tour__spot"), balao: caixa.querySelector(".tour__balao") };
    atual.aoMudar = function () { if (atual) posicionar(); };
    atual.aoTeclar = function (e) { if (!atual) return; if (e.key === "Escape") fechar(false); if (e.key === "ArrowRight" || e.key === "Enter") avancar(); if (e.key === "ArrowLeft") voltar(); };
    global.addEventListener("resize", atual.aoMudar); global.addEventListener("scroll", atual.aoMudar, true); document.addEventListener("keydown", atual.aoTeclar, true);
    caixa.addEventListener("click", function (e) { var b = e.target.closest("[data-tour]"); if (!b) return; var a = b.dataset.tour; if (a === "sair") fechar(false); if (a === "prox") avancar(); if (a === "ant") voltar(); });
    desenhar();
  }
  function fechar(concluido) { if (!atual) return; var s = atual; atual = null; global.removeEventListener("resize", s.aoMudar); global.removeEventListener("scroll", s.aoMudar, true); document.removeEventListener("keydown", s.aoTeclar, true); s.caixa.remove(); document.body.classList.remove("tour-aberto"); marcar(s.id); if (concluido) UI.vibrar(8); }
  function avancar() { if (!atual) return; if (atual.i >= atual.passos.length - 1) return fechar(true); atual.i++; desenhar(); }
  function voltar() { if (!atual || atual.i === 0) return; atual.i--; desenhar(); }
  function desenhar() {
    var s = atual, p = s.passos[s.i], ultimo = s.i === s.passos.length - 1;
    var alvo = alvoDe(p.alvo); if (alvo) alvo.scrollIntoView({ block: "center", behavior: "smooth" });
    s.balao.innerHTML = '<div class="tour__conta">Passo ' + (s.i + 1) + " de " + s.passos.length + '</div><h2 class="tour__titulo">' + U.esc(p.titulo) + '</h2><p class="tour__texto">' + U.esc(p.texto) + '</p><div class="tour__pontos">' + s.passos.map(function (_, i) { return '<i' + (i === s.i ? ' class="on"' : "") + "></i>"; }).join("") + '</div><div class="tour__acoes"><button type="button" class="btn btn--sm btn--fantasma" data-tour="sair">Sair</button><span class="esp"></span>' + (s.i > 0 ? '<button type="button" class="btn btn--sm btn--contorno" data-tour="ant">' + ic("arrow-left", "ic--sm") + "</button>" : "") + '<button type="button" class="btn btn--sm btn--primario" data-tour="prox">' + (ultimo ? "Concluir" : "Próximo") + "</button></div>";
    setTimeout(posicionar, alvo ? 350 : 0);
  }
  function posicionar() {
    var s = atual; if (!s) return; var p = s.passos[s.i], alvo = alvoDe(p.alvo), spot = s.spot, balao = s.balao, vh = global.innerHeight, vw = global.innerWidth;
    var largura = Math.min(360, vw - 24); balao.style.width = largura + "px";
    if (!alvo) { spot.hidden = true; balao.style.left = Math.round((vw - largura) / 2) + "px"; balao.style.top = Math.round((vh - (balao.offsetHeight || 200)) / 2) + "px"; return; }
    var r = alvo.getBoundingClientRect(), folga = 8, hb = balao.offsetHeight || 200;
    spot.hidden = false;
    var topoSpot = Math.max(0, r.top - folga), alturaSpot = Math.min(r.height + folga * 2, Math.max(110, vh - topoSpot - hb - 30), vh - topoSpot);
    spot.style.left = Math.max(0, r.left - folga) + "px"; spot.style.top = topoSpot + "px"; spot.style.width = Math.min(vw, r.width + folga * 2) + "px"; spot.style.height = alturaSpot + "px";
    var esq = Math.max(12, Math.min(r.left + r.width / 2 - largura / 2, vw - largura - 12));
    var abaixo = vh - (topoSpot + alturaSpot) - 14, topo = abaixo >= hb ? topoSpot + alturaSpot + 14 : topoSpot - 14 >= hb ? topoSpot - 14 - hb : vh - hb - 16;
    balao.style.left = Math.round(esq) + "px"; balao.style.top = Math.round(Math.max(12, Math.min(topo, vh - hb - 12))) + "px";
  }
  global.Tour = { iniciar: function (id) { iniciar(id, true); }, talvez: function (id) { setTimeout(function () { iniciar(id, false); }, 500); }, fechar: fechar, ROTEIROS: ROTEIROS, zerar: function () { try { localStorage.removeItem(CHAVE); } catch (e) {} } };
})(window);
