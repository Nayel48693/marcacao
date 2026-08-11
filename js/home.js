import { auth, db, BARBEARIA_ID, serverTimestamp, obterTokenNotificacoes } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js';
import { doc, getDoc, collection, addDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';
import { validarTelefonePT } from './validacao.js';

const form = document.getElementById('homeForm');
const servicoSelect = document.getElementById('servico') || document.getElementById('servicoAgendar');
const horarioInfo = document.getElementById('horarioInfo');
const dataInput = document.getElementById('data') || document.getElementById('dataAgendar');
const horaSelect = document.getElementById('hora') || document.getElementById('horaAgendar');
const nomeInput = document.getElementById('nomeCliente');
const telefoneInput = document.getElementById('telefoneCliente');
const feedback = document.getElementById('feedbackHome');
const btnNotificacoes = document.getElementById('btnNotificacoes');
const btnLogout = document.getElementById('btnLogout');
const nomePerfil = document.getElementById('nomePerfil');
const telefonePerfil = document.getElementById('telefonePerfil');
const profileAvatar = document.getElementById('profileAvatar');
const profileInitials = document.getElementById('profileInitials');
const profileSummary = document.getElementById('profileSummary');
const profileSummaryToggle = document.getElementById('profileSummaryToggle');
const profileActions = document.getElementById('profileActions');
const avatarUrlInput = document.getElementById('avatarUrl');
const nomePerfilInput = document.getElementById('nomePerfilInput');
const telefonePerfilInput = document.getElementById('telefonePerfilInput');
const perfilForm = document.getElementById('perfilForm');
const agendarForm = document.getElementById('agendarForm');
const feedbackAgendar = document.getElementById('feedbackAgendar');
const feedbackPerfil = document.getElementById('feedbackPerfil');

let perfilDados = {
  nome: '',
  telefone: '',
  avatarUrl: ''
};

function mostrarFeedback(mensagem, tipo = 'erro', elemento = feedback) {
  if (!elemento) return;
  elemento.textContent = mensagem;
  elemento.className = `feedback ${tipo}`;
}

function criarOpcao(select, texto, valor) {
  if (!select) return;
  const option = document.createElement('option');
  option.value = valor;
  option.textContent = texto;
  select.appendChild(option);
}

function atualizarAvatar(dados) {
  if (!profileAvatar || !profileInitials) return;
  const avatarUrl = dados?.avatarUrl;
  if (avatarUrl) {
    profileAvatar.querySelector('img')?.classList.add('visible');
    profileAvatar.querySelector('img').src = avatarUrl;
    profileAvatar.querySelector('img').alt = `${dados.nome || 'Cliente'} avatar`;
    profileInitials.style.display = 'none';
  } else {
    profileAvatar.querySelector('img')?.classList.remove('visible');
    profileInitials.style.display = 'grid';
    const initials = (dados?.nome || 'Cliente')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    profileInitials.textContent = initials || 'BF';
  }
}

function aplicarDadosPerfil(dados) {
  if (!dados) return;
  nomePerfil.textContent = dados.nome || 'Cliente';
  telefonePerfil.textContent = dados.telefone ? `+351 ${dados.telefone}` : '+351 000000000';
  nomeInput?.setAttribute('value', dados.nome || '');
  telefoneInput?.setAttribute('value', dados.telefone || '');
  nomePerfilInput?.setAttribute('value', dados.nome || '');
  telefonePerfilInput?.setAttribute('value', dados.telefone || '');
  avatarUrlInput?.setAttribute('value', dados.avatarUrl || '');
  atualizarAvatar(dados);
}

function obterValoresMarcacao() {
  const servico = servicoSelect?.value || '';
  const data = dataInput?.value || '';
  const hora = horaSelect?.value || '';
  const nome = nomeInput?.value.trim() || '';
  const telefone = telefoneInput?.value.trim() || '';
  return { servico, data, hora, nome, telefone };
}

function preencherHoras() {
  horaSelect.innerHTML = '<option value="">Escolhe uma hora</option>';
  const horarios = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
  horarios.forEach((hora) => criarOpcao(horaSelect, hora, hora));
}

async function carregarServicos() {
  if (!servicoSelect) return;

  try {
    const barbeariaRef = doc(db, 'barbearias', BARBEARIA_ID);
    const barbeariaSnap = await getDoc(barbeariaRef);

    servicoSelect.innerHTML = '<option value="">Escolhe um serviço</option>';

    if (barbeariaSnap.exists()) {
      const dados = barbeariaSnap.data();
      const servicos = dados?.servicos || [];
      const horarioFuncionamento = dados?.horarioFuncionamento;

      preencherHorarioInfo(horarioFuncionamento);

      if (Array.isArray(servicos) && servicos.length > 0) {
        servicos.forEach((item) => {
          const valor = typeof item === 'string' ? item : item?.nome || JSON.stringify(item);
          criarOpcao(servicoSelect, valor, valor);
        });
        return;
      }
    }

    preencherHorarioInfo(null);
    ['Corte clássico', 'Barba', 'Corte + barba'].forEach((item) => {
      criarOpcao(servicoSelect, item, item);
    });
  } catch (erro) {
    console.error('Erro ao carregar serviços:', erro);
    servicoSelect.innerHTML = '<option value="">Erro ao carregar serviços</option>';
  }
}

function configurarDataMinima() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  dataInput.min = `${ano}-${mes}-${dia}`;
}

function formatarHorario(horario) {
  if (typeof horario === 'string') {
    return horario;
  }

  if (Array.isArray(horario)) {
    return horario.join(' • ');
  }

  if (typeof horario === 'object' && horario !== null) {
    return Object.entries(horario)
      .map(([dia, valor]) => `${dia}: ${Array.isArray(valor) ? valor.join(', ') : valor}`)
      .join(' • ');
  }

  return 'Horário não disponível.';
}

function preencherHorarioInfo(horarioFuncionamento) {
  if (!horarioInfo) return;
  horarioInfo.textContent = formatarHorario(horarioFuncionamento || 'A carregar horário...');
}

async function registrarMarcacao(evento) {
  if (evento) evento.preventDefault();

  const { servico, data, hora, nome, telefone } = obterValoresMarcacao();

  if (!servico || !data || !hora || !nome || !validarTelefonePT(telefone)) {
    mostrarFeedback('Preenche todos os campos corretamente.', 'erro', feedbackAgendar || feedback);
    return;
  }

  const usuario = auth.currentUser;
  if (!usuario) {
    window.location.href = './login.html';
    return;
  }

  try {
    const tokenNotificacao = await obterTokenNotificacoes();

    await addDoc(collection(db, 'marcacoes'), {
      clienteId: usuario.uid,
      barbeariaId: BARBEARIA_ID,
      funcionarioId: null,
      servico,
      data,
      hora,
      status: 'pendente',
      nomeCliente: nome,
      telefone,
      fcmToken: tokenNotificacao || null,
      criadoEm: serverTimestamp()
    });

    const userRef = doc(db, 'utilizadores', usuario.uid);
    await updateDoc(userRef, {
      nome,
      telefone
    });

    nomePerfil.textContent = nome;
    telefonePerfil.textContent = `+351 ${telefone}`;

    mostrarFeedback('Marcação criada! Receberás notificações quando for atualizada.', 'sucesso', feedbackAgendar || feedback);
    form?.reset();
    agendarForm?.reset();
    preencherHoras();
  } catch (erro) {
    console.error('Erro ao criar marcação:', erro);
    mostrarFeedback('Não foi possível criar a marcação. Tenta novamente mais tarde.', 'erro');
  }
}

async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service worker não suportado neste navegador.');
    return;
  }

  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service worker registado com sucesso.');
  } catch (erro) {
    console.error('Não foi possível registar o service worker:', erro);
  }
}

async function pedirPermissaoNotificacoes() {
  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      mostrarFeedback('Permissão para notificações não concedida.', 'erro');
      return;
    }

    const token = await obterTokenNotificacoes();
    if (token) {
      mostrarFeedback('Notificações ativadas com sucesso.', 'sucesso');
    } else {
      mostrarFeedback('Não foi possível obter o token de notificações.', 'erro');
    }
  } catch (erro) {
    console.error('Erro ao pedir permissões de notificação:', erro);
    mostrarFeedback('Erro ao ativar notificações.', 'erro');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await registrarServiceWorker();
  configurarDataMinima();
  preencherHoras();
  carregarServicos();

  auth.onAuthStateChanged(async (usuario) => {
    if (!usuario) {
      window.location.href = './login.html';
      return;
    }

    try {
      const userRef = doc(db, 'utilizadores', usuario.uid);
      const userSnap = await getDoc(userRef);
      const dados = userSnap.data();

      if (!userSnap.exists() || !dados) {
        await signOut(auth);
        window.location.href = './login.html';
        return;
      }

      if (dados.role && dados.role !== 'cliente') {
        window.location.href = './painel.html';
        return;
      }

      perfilDados = {
        nome: dados.nome || '',
        telefone: dados.telefone || '',
        avatarUrl: dados.avatarUrl || ''
      };

      aplicarDadosPerfil(perfilDados);
    } catch (erro) {
      console.error('Erro a verificar role no home:', erro);
      window.location.href = './login.html';
    }
  });

  form?.addEventListener('submit', registrarMarcacao);
  agendarForm?.addEventListener('submit', registrarMarcacao);
  perfilForm?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const nome = nomePerfilInput?.value.trim();
    const telefone = telefonePerfilInput?.value.trim();
    const avatarUrl = avatarUrlInput?.value.trim();

    if (!nome || !validarTelefonePT(telefone)) {
      mostrarFeedback('Preenche todos os campos corretamente.', 'erro', feedbackPerfil);
      return;
    }

    try {
      const usuario = auth.currentUser;
      if (!usuario) {
        window.location.href = './login.html';
        return;
      }

      const userRef = doc(db, 'utilizadores', usuario.uid);
      await updateDoc(userRef, {
        nome,
        telefone,
        avatarUrl
      });

      perfilDados = { nome, telefone, avatarUrl };
      aplicarDadosPerfil(perfilDados);
      mostrarFeedback('Perfil atualizado com sucesso.', 'sucesso', feedbackPerfil);
    } catch (erro) {
      console.error('Erro ao atualizar perfil:', erro);
      mostrarFeedback('Não foi possível atualizar o perfil.', 'erro', feedbackPerfil);
    }
  });
  btnNotificacoes?.addEventListener('click', pedirPermissaoNotificacoes);
  btnLogout?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = './login.html';
  });

  profileSummaryToggle?.addEventListener('click', () => {
    profileSummary?.classList.toggle('active');
    profileSummaryToggle.setAttribute('aria-expanded', profileSummary?.classList.contains('active') ? 'true' : 'false');
  });

  profileSummaryToggle?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      profileSummary?.classList.toggle('active');
      profileSummaryToggle.setAttribute('aria-expanded', profileSummary?.classList.contains('active') ? 'true' : 'false');
    }
  });
});
