import { auth, db, BARBEARIA_ID, serverTimestamp } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

const servicosRef = collection(db, 'barbearias', BARBEARIA_ID, 'servicos');
const form = document.getElementById('servicoForm');
const nomeInput = document.getElementById('nomeServicoInput');
const precoInput = document.getElementById('precoServicoInput');
const lista = document.getElementById('listaServicos');
const feedback = document.getElementById('feedbackServicos');
const btnToggleLista = document.getElementById('btnToggleListaServicos');

function mostrarFeedback(mensagem, tipo = 'erro') {
  feedback.textContent = mensagem;
  feedback.className = `feedback ${tipo}`;
}

function formatarPreco(preco) {
  return `${Number(preco || 0).toFixed(2).replace('.', ',')} €`;
}

function criarBadgeAtivo(ativo) {
  const badge = document.createElement('span');
  badge.className = `status-tag ${ativo ? 'ativo' : 'inativo'}`;
  badge.textContent = ativo ? 'Ativo' : 'Inativo';
  return badge;
}

function criarBotao(texto, classe, aoClicar) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = `btn btn-small ${classe}`;
  botao.textContent = texto;
  botao.addEventListener('click', aoClicar);
  return botao;
}

function criarLinhaServico(id, dados) {
  const linha = document.createElement('div');
  const informacao = document.createElement('div');
  const nome = document.createElement('strong');
  const preco = document.createElement('span');
  const badgeEstado = criarBadgeAtivo(dados.ativo);
  const acoes = document.createElement('div');

  linha.className = 'table-row service-row';
  informacao.className = 'servico-info';
  nome.textContent = dados.nome;
  preco.textContent = formatarPreco(dados.preco);
  preco.className = 'servico-preco';
  informacao.append(nome, badgeEstado, preco);

  acoes.className = 'row-actions';
  acoes.appendChild(criarBotao('Editar', 'btn-secondary', () => ativarEdicao(linha, id, dados)));
  acoes.appendChild(criarBotao(dados.ativo ? 'Desativar' : 'Ativar', 'btn-secondary', () => alternarAtivo(id, dados.ativo)));

  linha.append(informacao, acoes);
  return linha;
}

function criarLinhaEdicao(id, dados, linhaOriginal) {
  const linha = document.createElement('div');
  const informacao = document.createElement('div');
  const nomeInputEdicao = document.createElement('input');
  const precoInputEdicao = document.createElement('input');
  const acoes = document.createElement('div');

  linha.className = 'table-row service-row service-row-editing';
  informacao.className = 'servico-info service-edit-fields';
  nomeInputEdicao.type = 'text';
  nomeInputEdicao.value = dados.nome || '';
  nomeInputEdicao.setAttribute('aria-label', 'Nome do serviço');
  precoInputEdicao.type = 'number';
  precoInputEdicao.step = '0.01';
  precoInputEdicao.min = '0';
  precoInputEdicao.value = Number(dados.preco || 0).toFixed(2);
  precoInputEdicao.setAttribute('aria-label', 'Preço do serviço');
  informacao.append(nomeInputEdicao, criarBadgeAtivo(dados.ativo), precoInputEdicao);

  acoes.className = 'row-actions';
  acoes.appendChild(criarBotao('Guardar', 'btn-primary', async () => {
    const nome = nomeInputEdicao.value.trim();
    const preco = Number(precoInputEdicao.value);

    if (!nome || !Number.isFinite(preco) || preco < 0) {
      mostrarFeedback('Preenche um nome e um preço válidos.', 'erro');
      return;
    }

    try {
      await updateDoc(doc(servicosRef, id), { nome, preco });
      await carregarServicos();
      mostrarFeedback('Serviço atualizado com sucesso.', 'sucesso');
    } catch (erro) {
      console.error('Erro ao editar serviço:', erro);
      mostrarFeedback('Não foi possível atualizar o serviço.', 'erro');
    }
  }));
  acoes.appendChild(criarBotao('Cancelar', 'btn-secondary', () => linha.replaceWith(linhaOriginal)));

  linha.append(informacao, acoes);
  return linha;
}

// Substitui a linha normal pelos campos de edição, sem usar prompts do navegador.
function ativarEdicao(linha, id, dados) {
  linha.replaceWith(criarLinhaEdicao(id, dados, linha));
}

async function alternarAtivo(id, ativoAtual) {
  try {
    await updateDoc(doc(servicosRef, id), { ativo: !ativoAtual });
    await carregarServicos();
  } catch (erro) {
    console.error('Erro ao alterar estado do serviço:', erro);
    mostrarFeedback('Não foi possível alterar o estado do serviço.', 'erro');
  }
}

async function carregarServicos() {
  lista.innerHTML = '';

  try {
    const servicosQuery = query(servicosRef, orderBy('nome'));
    const snapshot = await getDocs(servicosQuery);

    if (snapshot.empty) {
      lista.innerHTML = '<p>Ainda não tens serviços criados. Adiciona o primeiro serviço no formulário.</p>';
      return;
    }

    snapshot.forEach((documento) => {
      lista.appendChild(criarLinhaServico(documento.id, documento.data()));
    });
  } catch (erro) {
    console.error('Erro ao carregar serviços:', erro);
    mostrarFeedback('Não foi possível carregar os serviços.', 'erro');
  }
}

// Adiciona um novo serviço mantendo o estado ativo por defeito.
form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const nome = nomeInput.value.trim();
  const preco = parseFloat(precoInput.value);
  if (!nome || !Number.isFinite(preco) || preco < 0) {
    mostrarFeedback('Preenche um nome e um preço válidos.', 'erro');
    return;
  }

  try {
    await addDoc(servicosRef, {
      nome,
      preco,
      ativo: true,
      criadoEm: serverTimestamp(),
    });
    form.reset();
    await carregarServicos();
    mostrarFeedback('Serviço adicionado com sucesso.', 'sucesso');
  } catch (erro) {
    console.error('Erro ao adicionar serviço:', erro);
    mostrarFeedback('Não foi possível adicionar o serviço.', 'erro');
  }
});

// Alterna entre as duas vistas: formulário ou lista, nunca ambas ao mesmo tempo.
btnToggleLista?.addEventListener('click', () => {
  const listaVisivel = lista.classList.contains('hidden');
  lista.classList.toggle('hidden', !listaVisivel);
  form.classList.toggle('hidden', listaVisivel);
  btnToggleLista.setAttribute('aria-label', listaVisivel ? 'Esconder serviços' : 'Ver serviços');
  btnToggleLista.setAttribute('aria-expanded', String(listaVisivel));
});

// Apenas administradores e funcionários podem gerir o catálogo da barbearia.
auth.onAuthStateChanged(async (usuario) => {
  if (!usuario) {
    window.location.href = './home.html';
    return;
  }

  try {
    const utilizadorSnap = await getDoc(doc(db, 'utilizadores', usuario.uid));
    const dados = utilizadorSnap.exists() ? utilizadorSnap.data() : null;

    if (!dados || !['admin', 'funcionario'].includes(dados.role)) {
      await signOut(auth);
      window.location.href = './home.html';
      return;
    }

    await carregarServicos();
  } catch (erro) {
    console.error('Erro ao validar permissões:', erro);
    window.location.href = './home.html';
  }
});
