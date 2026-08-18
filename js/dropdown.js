// Componente de dropdown customizado
export function createDropdown(selectOrId) {
  const select = typeof selectOrId === 'string' ? document.getElementById(selectOrId) : selectOrId;
  if (!select) return null;

  // Esconde visualmente o select original, mantendo-o no DOM para submissão/validação
  select.classList.add('select-hidden');
  select.setAttribute('aria-hidden', 'true');

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-dropdown';
  wrapper.tabIndex = 0;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'custom-dropdown-button';
  button.innerHTML = `<span class="label">${getSelectedText(select) || 'Escolhe uma opção'}</span><span class="arrow">▾</span>`;
  // acessibilidade: aria-label baseado no texto do field (span) ou id do select
  const labelText = select.closest('.field')?.querySelector('span')?.textContent?.trim();
  button.setAttribute('aria-label', labelText || select.id || 'Selecionar');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  wrapper.appendChild(button);

  const list = document.createElement('div');
  list.className = 'custom-dropdown-list';
  list.setAttribute('role', 'listbox');
  list.tabIndex = -1;
  wrapper.appendChild(list);

  select.parentNode.insertBefore(wrapper, select.nextSibling);

  let items = [];
  let highlighted = -1;

  function buildItems() {
    list.innerHTML = '';
    items = [];
    Array.from(select.options).forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-dropdown-item';
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;
      if (!opt.value) item.classList.add('placeholder');
      item.addEventListener('click', () => selectValue(opt.value));
      list.appendChild(item);
      items.push(item);
      if (opt.selected) {
        highlight(idx);
      }
    });
  }

  function getSelectedText(s) {
    const opt = s.options[s.selectedIndex];
    return opt ? opt.textContent : '';
  }

  function open() {
    wrapper.classList.add('open');
    list.style.display = 'block';
    button.setAttribute('aria-expanded', 'true');
    highlighted = items.findIndex((it) => it.classList.contains('active'));
    if (highlighted === -1) highlighted = 0;
    highlight(highlighted);
  }

  function close() {
    wrapper.classList.remove('open');
    list.style.display = 'none';
    button.setAttribute('aria-expanded', 'false');
  }

  function highlight(index) {
    if (items.length === 0) return;
    items.forEach((it) => it.classList.remove('active'));
    highlighted = Math.max(0, Math.min(items.length - 1, index));
    const el = items[highlighted];
    if (el) el.classList.add('active');
    // scroll into view
    el?.scrollIntoView({ block: 'nearest' });
  }

  function selectValue(value) {
    // Atualiza o select original e despacha evento change
    select.value = value;
    const evt = new Event('change', { bubbles: true });
    select.dispatchEvent(evt);
    // Atualiza botão
    button.querySelector('.label').textContent = getSelectedText(select) || 'Escolhe uma opção';
    close();
  }

  // keyboard handlers
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!wrapper.classList.contains('open')) open();
      highlight((highlighted + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!wrapper.classList.contains('open')) open();
      highlight((highlighted - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (wrapper.classList.contains('open') && items[highlighted]) {
        selectValue(items[highlighted].dataset.value);
      } else {
        open();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  button.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (wrapper.classList.contains('open')) close(); else open();
  });

  // fecha ao clicar fora
  document.addEventListener('click', (ev) => {
    if (!wrapper.contains(ev.target)) close();
  });

  // Observa mudanças nas options do select
  const mo = new MutationObserver(() => buildItems());
  mo.observe(select, { childList: true, subtree: false });

  // atualiza quando select muda externamente
  select.addEventListener('change', () => {
    button.querySelector('.label').textContent = getSelectedText(select) || 'Escolhe uma opção';
    buildItems();
  });

  // inicializa
  buildItems();
  close();

  return { wrapper, button, list, rebuild: buildItems };
}
