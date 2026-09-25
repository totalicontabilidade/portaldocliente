"""Carimba a versão nova em todo o site antes de publicar.

    python ferramentas/versao.py            (versão = data e hora de agora)
    python ferramentas/versao.py 2026-09-25p

O que faz:
  1. sw.js: VERSAO = "<versão>" (renova o cache de reserva do service worker);
  2. index.html, equipe.html, anterior.html e extratos.html: todo js/, css/ e lib/
     local passa a ser pedido com ?v=<versão>.

Por que: o GitHub Pages guarda cada arquivo por até 10 min. Sem a versão no endereço,
logo depois de publicar o navegador podia receber o painel.js novo com o util.js velho
(tela quebrada). Com ?v=, a página velha pede tudo velho e a nova pede tudo novo.
"""
import io, os, re, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
versao = sys.argv[1] if len(sys.argv) > 1 else time.strftime("%Y%m%d-%H%M")

sw = os.path.join(RAIZ, "sw.js")
s = io.open(sw, encoding="utf-8").read()
s, n = re.subn(r'var VERSAO = "[^"]*";', 'var VERSAO = "%s";' % versao, s, count=1)
assert n == 1, "VERSAO não encontrada em sw.js"
io.open(sw, "w", encoding="utf-8", newline="\n").write(s)

padrao = re.compile(r'((?:src|href)=")((?:js|css|lib)/[^"?]+)(?:\?v=[^"]*)?(")')
total = 0
for pagina in ("index.html", "equipe.html", "anterior.html", "extratos.html"):
    p = os.path.join(RAIZ, pagina)
    h = io.open(p, encoding="utf-8").read()
    h, n = padrao.subn(lambda m: m.group(1) + m.group(2) + "?v=" + versao + m.group(3), h)
    total += n
    io.open(p, "w", encoding="utf-8", newline="\n").write(h)
print("versão %s: sw.js e %d referências nas 4 páginas" % (versao, total))
