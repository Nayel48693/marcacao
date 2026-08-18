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
const btnConvidar = document.getElementById('btnConvidarFuncionario');

function mostrarFeedback(mensagem, tipo = 'erro') {
  if (!feedbackPainel) return;
  feedbackPainel.textContent = mensagem;
  feedbackPainel.className = `feedback ${tipo}`;
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

    const barbeariaRef = doc(db, 'barbearias', BARBEARIA_ID);
    await getDoc(barbeariaRef);
    barbeariaNome.textContent = 'Barbearia Feitosa';

    await carregarResumo();
    await carregarConvites();
    await carregarMarcacoesRecentes();
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
    await signOut(auth);
    window.location.href = './login.html';
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
});
