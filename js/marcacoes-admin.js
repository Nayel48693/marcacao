import { db, BARBEARIA_ID } from './firebase-config.js';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';

const lista = document.getElementById('listaMarcacoesAdmin');
const filtro = document.getElementById('filtroEstado');

const nomesEstados = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  adiada: 'Adiada',
};

// Converte a data e a hora num valor ordenável sem alterar o formato guardado no Firestore.
function compararMarcacoes(primeira, segunda) {
  const primeiraData = `${primeira.data || ''} ${primeira.hora || ''}`;
  const segundaData = `${segunda.data || ''} ${segunda.hora || ''}`;
  return primeiraData.localeCompare(segundaData);
}

function criarBadgeEstado(estado) {
  const badge = document.createElement('span');
  badge.className = `status-tag ${estado}`;
  badge.textContent = nomesEstados[estado] || estado;
  return badge;
}

function criarBotaoAcao(id, texto, novoEstado, confirmarCancelamento = false) {
  const botao = document.createElement('button');

  botao.type = 'button';
  botao.className = 'btn btn-small btn-secondary';
  botao.textContent = texto;
  botao.addEventListener('click', async () => {
    if (confirmarCancelamento && !confirm('Tens a certeza que queres cancelar esta marcação?')) return;
    await updateDoc(doc(db, 'marcacoes', id), { status: novoEstado });
    await carregar();
  });

  return botao;
}

// Cria apenas as ações permitidas para o estado atual da marcação.
function criarAcoesMarcacao(id, estado) {
  const acoesPorEstado = {
    pendente: [
      ['Confirmar', 'confirmada'],
      ['Cancelar', 'cancelada', true],
    ],
    confirmada: [
      ['Concluir', 'concluida'],
      ['Adiar', 'adiada'],
      ['Cancelar', 'cancelada', true],
    ],
    adiada: [['Reagendar', 'pendente']],
  };
  const acoes = acoesPorEstado[estado] || [];

  if (acoes.length === 0) return null;

  const actions = document.createElement('div');
  actions.className = 'row-actions';

  acoes.forEach(([texto, novoEstado, confirmarCancelamento]) => {
    actions.appendChild(criarBotaoAcao(id, texto, novoEstado, confirmarCancelamento));
  });

  return actions;
}

async function carregar() {
  lista.innerHTML = '';
  const estadoFiltrado = filtro.value;
  const consulta = query(
    collection(db, 'marcacoes'),
    where('barbeariaId', '==', BARBEARIA_ID),
  );
  const snapshot = await getDocs(consulta);
  const marcacoes = snapshot.docs
    .map((documento) => ({ id: documento.id, ...documento.data() }))
    .sort(compararMarcacoes);
  const marcacoesVisiveis = marcacoes.filter(
    (marcacao) => estadoFiltrado === 'todas' || marcacao.status === estadoFiltrado,
  );

  if (marcacoesVisiveis.length === 0) {
    lista.innerHTML = '<p>Nenhuma marcação encontrada.</p>';
    return;
  }

  marcacoesVisiveis.forEach((marcacao) => {
    const row = document.createElement('div');
    const informacao = document.createElement('div');
    const nome = document.createElement('strong');
    const detalhes = document.createElement('div');
    const estado = marcacao.status;
    const badge = criarBadgeEstado(estado);

    row.className = 'table-row';
    nome.textContent = marcacao.nomeCliente;
    detalhes.textContent = `${marcacao.servico} - ${marcacao.data} ${marcacao.hora}`;
    informacao.append(nome, detalhes);
    row.append(informacao, badge);
    const actions = criarAcoesMarcacao(marcacao.id, estado);
    if (actions) row.appendChild(actions);
    lista.appendChild(row);
  });
}

filtro.addEventListener('change', carregar);
carregar();
