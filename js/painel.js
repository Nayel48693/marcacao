import { auth, db, BARBEARIA_ID, serverTimestamp } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js';
import { doc, getDoc, collection, query, where, getDocs, addDoc, orderBy, limit, updateDoc } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

const usuarioNome = document.getElementById('usuarioNome');
const usuarioRole = document.getElementById('usuarioRole');
const barbeariaNome = document.getElementById('barbeariaNome');
const estatisticasList = document.getElementById('estatisticasList');
const convitesList = document.getElementById('convitesList');
const conviteForm = document.getElementById('conviteForm');
const conviteTelefoneInput = document.getElementById('conviteTelefoneInput');
const btnEnviarConvite = document.getElementById('btnEnviarConvite');
const marcacoesList = document.getElementById('marcacoesList');
const feedbackPainel = document.getElementById('feedbackPainel');
const btnLogout = document.getElementById('btnLogoutPainel');
const adminProfileButton = document.getElementById('adminProfileButton');
const adminProfileDropdown = document.getElementById('adminProfileDropdown');
const adminProfileName = document.getElementById('adminProfileName');
const adminProfileImg = document.getElementById('adminProfileImg');
const adminProfileInitials = document.getElementById('adminProfileInitials');
const btnConvidar = document.getElementById('btnConvidarFuncionario');
const horariosForm = document.getElementById('horariosForm');
const horarioAberturaInput = document.getElementById('horarioAberturaInput');
const horarioFechoInput = document.getElementById('horarioFechoInput');
const intervaloMinutosInput = document.getElementById('intervaloMinutosInput');
const pausaInicioInput = document.getElementById('pausaInicioInput');
const pausaFimInput = document.getElementById('pausaFimInput');
const feedbackHorarios = document.getElementById('feedbackHorarios');

function mostrarFeedback(mensagem, tipo = 'erro') {
  if (!feedbackPainel) return;
  feedbackPainel.textContent = mensagem;
  feedbackPainel.className = `feedback ${tipo}`;
}

function atualizarPerfilAdmin(dados) {
  const nome = dados.nome || 'Administrador';
  const avatarUrl = dados.avatarUrl || '';
  adminProfileName && (adminProfileName.textContent = nome);

  if (avatarUrl && adminProfileImg) {
    adminProfileImg.src = avatarUrl;
    adminProfileImg.style.display = 'block';
    adminProfileInitials && (adminProfileInitials.style.display = 'none');
    return;
  }

  adminProfileImg && (adminProfileImg.style.display = 'none');
  if (adminProfileInitials) {
    const iniciais = nome
      .split(' ')
      .filter(Boolean)
      .map((parte) => parte[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    adminProfileInitials.textContent = iniciais || '?';
    adminProfileInitials.style.display = 'grid';
  }
}

function criarItemLista(lista, titulo, valor) {
  if (!lista) return;
  const item = document.createElement('div');
  item.className = 'stat-card';
  item.innerHTML = `<strong>${titulo}</strong><p>${valor}</p>`;
  lista.appendChild(item);
}

function criarLinhaTabela(lista, texto) {
  if (!lista) return;
  const linha = document.createElement('div');
  linha.className = 'table-row';
  linha.textContent = texto;
  lista.appendChild(linha);
}

function criarLinhaConvite(lista, conviteId, dados) {
  if (!lista) return;
  const linha = document.createElement('div');
  linha.className = 'table-row invite-row';

  const texto = document.createElement('div');
  texto.innerHTML = `<strong>${dados.telefoneConvidado}</strong><span class="status-tag ${dados.status}">${dados.status.replace(/\b\w/g, (l) => l.toUpperCase())}</span>`;

  linha.appendChild(texto);

  lista.appendChild(linha);
}

async function aceitarConvite(conviteId) {
  try {
    await updateDoc(doc(db, 'convitesFuncionario', conviteId), {
      status: 'aceite'
    });
    mostrarFeedback('Convite aceite. Agora o funcionário pode registar-se.', 'sucesso');
    carregarConvites();
  } catch (erro) {
    console.error('Erro ao aceitar convite:', erro);
    mostrarFeedback('Não foi possível aceitar o convite.', 'erro');
  }
}

// Preenche o formulário de horários com os valores existentes
async function preencherFormularioHorarios() {
  try {
    const barbeariaRef = doc(db, 'barbearias', BARBEARIA_ID);
    const barbeariaSnap = await getDoc(barbeariaRef);

    if (barbeariaSnap.exists()) {
      const dados = barbeariaSnap.data();
      const config = dados.configHorarios || {};

      if (horarioAberturaInput)
        horarioAberturaInput.value = config.abertura || '09:00';
      if (horarioFechoInput)
        horarioFechoInput.value = config.fecho || '18:00';
      if (intervaloMinutosInput)
        intervaloMinutosInput.value = config.intervaloMinutos || '60';
      if (pausaInicioInput)
        pausaInicioInput.value = config.pausaInicio || '';
      if (pausaFimInput)
        pausaFimInput.value = config.pausaFim || '';
    }
  } catch (erro) {
    console.error('Erro ao carregar configuração de horários:', erro);
  }
}

async function carregarDadosAdmin(uid) {
  try {
    const userRef = doc(db, 'utilizadores', uid);
    const userSnap = await getDoc(userRef);
    const dados = userSnap.data();

    if (!userSnap.exists() || !dados) {
      await signOut(auth);
      window.location.href = './login.html';
      return;
    }

    usuarioNome.textContent = dados.nome || 'Administrador';
    usuarioRole.textContent = dados.role === 'admin' ? 'Admin' : 'Funcionário';
    atualizarPerfilAdmin(dados);

    const barbeariaRef = doc(db, 'barbearias', BARBEARIA_ID);
    await getDoc(barbeariaRef);
    barbeariaNome.textContent = 'Barbearia Feitosa';

    await carregarResumo();
    await carregarConvites();
    await carregarMarcacoesRecentes();
    await preencherFormularioHorarios();
  } catch (erro) {
    console.error('Erro ao carregar dados admin:', erro);
    mostrarFeedback('Erro ao carregar o painel. Tenta recarregar a página.', 'erro');
  }
}

async function carregarResumo() {
  estatisticasList.innerHTML = '';

  const marcacoesQuery = query(
    collection(db, 'marcacoes'),
    where('barbeariaId', '==', BARBEARIA_ID)
  );
  const marcacoesSnap = await getDocs(marcacoesQuery);
  const totalMarcacoes = marcacoesSnap.size;
  const pendentes = marcacoesSnap.docs.filter((doc) => doc.data().status === 'pendente').length;

  const convitesQuery = query(
    collection(db, 'convitesFuncionario'),
    where('barbeariaId', '==', BARBEARIA_ID)
  );
  const convitesSnap = await getDocs(convitesQuery);
  const totalConvites = convitesSnap.size;
  const convitesAceites = convitesSnap.docs.filter((linha) => linha.data().status === 'aceite').length;

  criarItemLista(estatisticasList, 'Marcações totais', totalMarcacoes);
  criarItemLista(estatisticasList, 'Pendentes', pendentes);
  criarItemLista(estatisticasList, 'Convites aceites', convitesAceites);
}

async function carregarConvites() {
  convitesList.innerHTML = '';

  const queryConvites = query(
    collection(db, 'convitesFuncionario'),
    where('barbeariaId', '==', BARBEARIA_ID),
    orderBy('criadoEm', 'desc'),
    limit(5)
  );
  const convitesSnap = await getDocs(queryConvites);

  if (convitesSnap.empty) {
    criarLinhaTabela(convitesList, 'Nenhum convite enviado ainda.');
    return;
  }

  convitesSnap.forEach((convite) => {
    criarLinhaConvite(convitesList, convite.id, convite.data());
  });
}

async function carregarMarcacoesRecentes() {
  marcacoesList.innerHTML = '';

  const queryMarcacoes = query(
    collection(db, 'marcacoes'),
    where('barbeariaId', '==', BARBEARIA_ID),
    orderBy('criadoEm', 'desc'),
    limit(5)
  );
  const marcacoesSnap = await getDocs(queryMarcacoes);

  if (marcacoesSnap.empty) {
    criarLinhaTabela(marcacoesList, 'Nenhuma marcação recente.');
    return;
  }

  marcacoesSnap.forEach((marcacao) => {
    const dados = marcacao.data();
    criarLinhaTabela(marcacoesList, `${dados.servico} — ${dados.data} ${dados.hora} — ${dados.status}`);
  });
}

async function convidarFuncionario() {
  // Esta função deixou de usar prompt; manter por compatibilidade.
}

document.addEventListener('DOMContentLoaded', () => {
  const cartoes = [...document.querySelectorAll('.admin-card')];
  const tabs = [...document.querySelectorAll('.tab-item')];

  // Sincroniza o cartão visível com o separador selecionado no telemóvel.
  function mostrarCartao(targetId, tabAtiva) {
    cartoes.forEach((cartao) => {
      cartao.classList.toggle('active-mobile-card', cartao.id === targetId);
    });
    tabs.forEach((tab) => tab.classList.toggle('active', tab === tabAtiva));
  }

  const tabInicial = tabs.find((tab) => tab.dataset.target === 'cardResumo');
  mostrarCartao('cardResumo', tabInicial);
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => mostrarCartao(tab.dataset.target, tab));
  });

  auth.onAuthStateChanged(async (usuario) => {
    if (!usuario) {
      window.location.href = './login.html';
      return;
    }

    try {
      const userRef = doc(db, 'utilizadores', usuario.uid);
      const userSnap = await getDoc(userRef);
      const dados = userSnap.data();

      if (!userSnap.exists() || !dados || !['admin', 'funcionario'].includes(dados.role)) {
        await signOut(auth);
        window.location.href = './login.html';
        return;
      }

      await carregarDadosAdmin(usuario.uid);
    } catch (erro) {
      console.error('Erro ao validar admin:', erro);
      window.location.href = './login.html';
    }
  });

  btnLogout?.addEventListener('click', async () => {
    // Evita terminar a sessão acidentalmente no painel administrativo.
    if (!confirm('Tens a certeza que queres sair?')) {
      return;
    }
    await signOut(auth);
    window.location.href = './login.html';
  });

  // Abre e fecha o menu do perfil no navbar administrativo.
  adminProfileButton?.addEventListener('click', (evento) => {
    evento.stopPropagation();
    adminProfileDropdown?.classList.toggle('open');
    adminProfileButton.setAttribute('aria-expanded', adminProfileDropdown?.classList.contains('open') ? 'true' : 'false');
  });
  document.addEventListener('click', () => {
    adminProfileDropdown?.classList.remove('open');
    adminProfileButton?.setAttribute('aria-expanded', 'false');
  });

  // Enviar convite usando o formulário inline
  btnEnviarConvite?.addEventListener('click', async () => {
    const telefone = conviteTelefoneInput?.value?.trim();
    if (!telefone || telefone.length !== 9) {
      mostrarFeedback('Insere um telefone válido com 9 dígitos.', 'erro');
      return;
    }

    try {
      await addDoc(collection(db, 'convitesFuncionario'), {
        barbeariaId: BARBEARIA_ID,
        telefoneConvidado: telefone,
        status: 'pendente',
        criadoEm: serverTimestamp()
      });

      mostrarFeedback('Convite enviado com sucesso.', 'sucesso');
      conviteTelefoneInput.value = '';
      carregarConvites();
    } catch (erro) {
      console.error('Erro ao convidar funcionário:', erro);
      mostrarFeedback('Não foi possível enviar o convite.', 'erro');
    }
  });

  // Listener para o formulário de horários
  horariosForm?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const abertura = horarioAberturaInput?.value?.trim();
    const fecho = horarioFechoInput?.value?.trim();
    const intervaloMinutos = parseInt(intervaloMinutosInput?.value || '60', 10);
    const pausaInicio = pausaInicioInput?.value?.trim() || '';
    const pausaFim = pausaFimInput?.value?.trim() || '';

    // Validações
    if (!abertura || !fecho) {
      if (feedbackHorarios) {
        feedbackHorarios.textContent = 'Preenche os campos de abertura e fecho.';
        feedbackHorarios.className = 'feedback erro';
      }
      return;
    }

    if (abertura >= fecho) {
      if (feedbackHorarios) {
        feedbackHorarios.textContent = 'A hora de abertura deve ser antes da hora de fecho.';
        feedbackHorarios.className = 'feedback erro';
      }
      return;
    }

    if (pausaInicio && pausaFim) {
      if (pausaInicio >= pausaFim) {
        if (feedbackHorarios) {
          feedbackHorarios.textContent = 'O início da pausa deve ser antes do fim da pausa.';
          feedbackHorarios.className = 'feedback erro';
        }
        return;
      }

      if (pausaInicio < abertura || pausaInicio >= fecho) {
        if (feedbackHorarios) {
          feedbackHorarios.textContent = 'O início da pausa deve estar entre a abertura e fecho.';
          feedbackHorarios.className = 'feedback erro';
        }
        return;
      }

      if (pausaFim <= abertura || pausaFim > fecho) {
        if (feedbackHorarios) {
          feedbackHorarios.textContent = 'O fim da pausa deve estar entre a abertura e fecho.';
          feedbackHorarios.className = 'feedback erro';
        }
        return;
      }
    }

    try {
      const barbeariaRef = doc(db, 'barbearias', BARBEARIA_ID);
      await updateDoc(barbeariaRef, {
        configHorarios: {
          abertura,
          fecho,
          intervaloMinutos,
          pausaInicio,
          pausaFim
        }
      });

      if (feedbackHorarios) {
        feedbackHorarios.textContent = 'Horários atualizados com sucesso.';
        feedbackHorarios.className = 'feedback sucesso';
      }
    } catch (erro) {
      console.error('Erro ao guardar configuração de horários:', erro);
      if (feedbackHorarios) {
        feedbackHorarios.textContent = 'Não foi possível guardar os horários.';
        feedbackHorarios.className = 'feedback erro';
      }
    }
  });
});
