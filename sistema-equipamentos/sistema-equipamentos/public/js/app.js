(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Menu lateral no celular
  var btn = $('.menu-btn');
  if (btn) btn.addEventListener('click', function () { document.body.classList.toggle('menu-aberto'); });
  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('menu-aberto') && !e.target.closest('.sidebar') && !e.target.closest('.menu-btn')) document.body.classList.remove('menu-aberto');
  });

  // Mostrar/ocultar senha
  $$('[data-toggle-senha]').forEach(function (b) {
    b.addEventListener('click', function () {
      var input = b.parentElement.querySelector('input');
      var mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      b.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    });
  });

  // Abrir/fechar <dialog>
  $$('[data-abrir]').forEach(function (b) {
    b.addEventListener('click', function () {
      var d = document.getElementById(b.getAttribute('data-abrir'));
      if (!d) return;
      // formulários de cadastro/edição: preenche com os data-* do botão
      var form = d.querySelector('form');
      if (form && b.hasAttribute('data-action')) {
        form.action = b.getAttribute('data-action');
        var titulo = d.querySelector('[data-titulo]');
        if (titulo && b.getAttribute('data-titulo')) titulo.textContent = b.getAttribute('data-titulo');
        $$('[name]', form).forEach(function (el) {
          if (el.name === '_csrf') return;
          var v = b.getAttribute('data-' + el.name.replace(/_/g, '-'));
          if (el.type === 'checkbox') el.checked = v === null ? true : v === '1';
          else el.value = v === null ? '' : v;
        });
      }
      // confirmação genérica
      if (d.id === 'dlg-confirmar') {
        d.querySelector('form').action = b.getAttribute('data-confirm-action');
        d.querySelector('[data-c-titulo]').textContent = b.getAttribute('data-confirm-titulo');
        d.querySelector('[data-c-texto]').textContent = b.getAttribute('data-confirm-texto');
        var ok = d.querySelector('[data-c-ok]');
        ok.textContent = b.getAttribute('data-confirm-botao');
        ok.className = 'btn ' + (b.getAttribute('data-confirm-perigo') === '1' ? 'btn-perigo' : 'btn-primario');
        var j = d.querySelector('[data-c-just]');
        if (j) { j.hidden = b.getAttribute('data-confirm-just') !== '1'; j.querySelector('textarea').required = !j.hidden; j.querySelector('textarea').value = ''; }
      }
      d.showModal();
      var primeiro = d.querySelector('input:not([type=hidden]):not([type=checkbox]), textarea, select');
      if (primeiro) primeiro.focus();
    });
  });
  $$('[data-fechar]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });
  $$('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  // Fecha o aviso
  $$('[data-fechar-toast]').forEach(function (b) { b.addEventListener('click', function () { b.parentElement.remove(); }); });

  // Impede envio duplo
  $$('form').forEach(function (f) {
    f.addEventListener('submit', function () {
      var s = f.querySelector('button[type=submit]');
      if (s) setTimeout(function () { s.disabled = true; }, 0);
    });
  });

  // Reabre modal de erro de alteração de situação, se houver
  var abrir = $('[data-auto-abrir]');
  if (abrir && abrir.getAttribute('data-auto-abrir')) { var dd = document.getElementById(abrir.getAttribute('data-auto-abrir')); if (dd) dd.showModal(); }
})();
