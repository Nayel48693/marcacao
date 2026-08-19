import { auth, db, BARBEARIA_ID, serverTimestamp, obterTokenNotificacoes } from './firebase-config.js';
import { createDropdown } from './dropdown.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js';
import { doc, getDoc, collection, addDoc, updateDoc, query, where, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';
import { validarTelefonePT } from './validacao.js';

// Cloudinary (substitua pelos seus valores) - mantidos comentados para o utilizador preencher
// const CLOUD_NAME = 'SEU_CLOUD_NAME';
// const UPLOAD_PRESET = 'SEU_UPLOAD_PRESET';

// Limite padrão de marcações ativas por cliente (fallback)
const LIMITE_MARCACOES_ATIVAS = 2;
const LIMITE_DIAS_ANTECEDENCIA = 60;
const ANTECEDENCIA_MINIMA_HORAS = 2;

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
// Novo chip de perfil (IDs presentes na versão atualizada do HTML)
const profileChipButton = document.getElementById('profileChipButton');
const profileDropdown = document.getElementById('profileDropdown');
const dropdownLogout = document.getElementById('dropdownLogout');
const profileChipName = document.getElementById('profileChipName');
const profileAvatarSmall = document.getElementById('profileAvatarSmall');
const profileChipImg = document.getElementById('profileChipImg');
const profileChipInitials = document.getElementById('profileChipInitials');
const avatarUrlInput = document.getElementById('avatarUrl');
const nomePerfilInput = document.getElementById('nomePerfilInput');
const telefonePerfilInput = document.getElementById('telefonePerfilInput');
const perfilForm = document.getElementById('perfilForm');
const avatarFileInput = document.getElementById('avatarFile');
const avatarPreview = document.getElementById('avatarPreview');
const telefonePerfilReadOnly = document.getElementById('telefonePerfilReadOnly');
const agendarForm = document.getElementById('agendarForm');
const agendarSubmitBtn = agendarForm?.querySelector('button[type="submit"]');
const cancelarMarcacaoBtn = document.getElementById('cancelarMarcacaoBtn');
const agendarTitulo = document.getElementById('agendarTitulo');
const feedbackAgendar = document.getElementById('feedbackAgendar');
const feedbackPerfil = document.getElementById('feedbackPerfil');
const inviteBanner = document.getElementById('inviteBanner');
const inviteAcceptBtn = document.getElementById('inviteAcceptBtn');
const inviteLaterBtn = document.getElementById('inviteLaterBtn');
const upcomingList = document.getElementById('upcomingList');
const historyList = document.getElementById('historyList');

let marcacaoEditId = null;
let marcacaoDataOriginal = null;
let marcacaoServicoOriginal = null;
let marcacaoHoraOriginal = null;

let perfilDados = {
  nome: '',
  telefone: '',
  avatarUrl: ''
};

// Configuração de horários da barbearia (carregada do Firestore)
let configHorariosBarbearia = null;

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
  const avatarUrl = dados?.avatarUrl;
  // atualizar avatar grande (se existir)
  if (profileAvatar) {
    try {
      const img = profileAvatar.querySelector('img');
      if (avatarUrl) {
        img?.classList.add('visible');
        if (img) img.src = avatarUrl;
        if (img) img.alt = `${dados.nome || 'Cliente'} avatar`;
        profileInitials && (profileInitials.style.display = 'none');
      } else {
        img?.classList.remove('visible');
        profileInitials && (profileInitials.style.display = 'grid');
        const initials = (dados?.nome || 'Cliente')
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        profileInitials && (profileInitials.textContent = initials || 'BF');
      }
    } catch (e) {
      // ignore
    }
  }

  // atualizar chip pequeno
  if (profileAvatarSmall) {
    if (avatarUrl) {
      // mostra a imagem no chip e oculta as iniciais
      if (profileChipImg) {
        profileChipImg.src = avatarUrl;
        profileChipImg.style.display = 'block';
      }
      if (profileChipInitials) profileChipInitials.style.display = 'none';
    } else {
      // sem imagem: mostra iniciais num círculo dourado
      if (profileChipImg) profileChipImg.style.display = 'none';
      if (profileChipInitials) {
        const initials = (dados?.nome || 'Cliente')
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
        profileChipInitials.textContent = initials || '?';
        profileChipInitials.style.display = 'grid';
      }
    }
  }
}

function aplicarDadosPerfil(dados) {
  if (!dados) return;
  // atualizar nomes em possíveis localizações
  nomePerfil && (nomePerfil.textContent = dados.nome || 'Cliente');
  profileChipName && (profileChipName.textContent = dados.nome || 'Cliente');
  telefonePerfil && (telefonePerfil.textContent = dados.telefone ? `+351 ${dados.telefone}` : '+351 000000000');
  if (telefonePerfilReadOnly) telefonePerfilReadOnly.textContent = dados.telefone || '';
  nomeInput?.setAttribute('value', dados.nome || '');
  telefoneInput?.setAttribute('value', dados.telefone || '');
  nomePerfilInput?.setAttribute('value', dados.nome || '');
  avatarUrlInput?.setAttribute('value', dados.avatarUrl || '');

  // Recupera a foto guardada no Firestore ao abrir a página de perfil.
  if (avatarPreview) {
    if (dados.avatarUrl) {
      avatarPreview.innerHTML = `<img src="${dados.avatarUrl}" alt="Foto de perfil"/>`;
    } else {
      const iniciais = (dados.nome || '')
        .split(' ')
        .filter(Boolean)
        .map((parte) => parte[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?';
      avatarPreview.innerHTML = `<span class="chip-initials">${iniciais}</span>`;
    }
  }

  atualizarAvatar(dados);
}

function obterValoresMarcacao() {
  const servico = servicoSelect?.value || '';
  const data = dataInput?.value || '';
  const hora = horaSelect?.value || '';
  // Se os inputs de nome/telefone não existirem nesta página (ex: pages/agendar.html),
  // usa os valores já carregados em perfilDados.
  const nome = nomeInput ? (nomeInput.value.trim() || '') : (perfilDados.nome || '');
  const telefone = telefoneInput ? (telefoneInput.value.trim() || '') : (perfilDados.telefone || '');
  return { servico, data, hora, nome, telefone };
}

function bloquearEdicaoOuCancelamentoSeProximaHora(dadosMarcacao) {
  if (!dadosMarcacao?.data || !dadosMarcacao?.hora) return false;

  const dataHoraMarcacao = new Date(`${dadosMarcacao.data}T${dadosMarcacao.hora}:00`);
  const horasAteMarcacao = (dataHoraMarcacao - new Date()) / (1000 * 60 * 60);

  if (horasAteMarcacao < ANTECEDENCIA_MINIMA_HORAS) {
    [servicoSelect, dataInput, horaSelect].forEach((campo) => {
      if (campo) campo.disabled = true;
    });

    if (agendarSubmitBtn) agendarSubmitBtn.disabled = true;
    if (cancelarMarcacaoBtn) cancelarMarcacaoBtn.disabled = true;

    if (feedbackAgendar) {
      feedbackAgendar.textContent = 'Esta marcação é daqui a menos de 2 horas — já não pode ser editada ou cancelada online. Contacta a barbearia diretamente.';
      feedbackAgendar.className = 'feedback erro';
    }

    return true;
  }

  return false;
}

// Gera os slots de horário baseado na configuração (abertura, fecho, intervalo, pausa)
function gerarSlotsHorario(config) {
  const cfg = config || {
    abertura: '09:00',
    fecho: '18:00',
    intervaloMinutos: 60,
    pausaInicio: '',
    pausaFim: ''
  };

  const slots = [];
  const [hIni, mIni] = cfg.abertura.split(':').map(Number);
  const [hFim, mFim] = cfg.fecho.split(':').map(Number);

  let minutos = hIni * 60 + mIni;
  const minutosFim = hFim * 60 + mFim;

  while (minutos < minutosFim) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    const horaStr = `${h}:${m}`;

    const dentroDaPausa =
      cfg.pausaInicio && cfg.pausaFim && horaStr >= cfg.pausaInicio && horaStr < cfg.pausaFim;

    if (!dentroDaPausa) {
      slots.push(horaStr);
    }

    minutos += cfg.intervaloMinutos;
  }

  return slots;
}

// Carrega a configuração de horários do documento da barbearia
async function carregarConfigHorarios() {
  try {
    const barbeariaRef = doc(db, 'barbearias', BARBEARIA_ID);
    const barbeariaSnap = await getDoc(barbeariaRef);

    if (barbeariaSnap.exists()) {
      const dados = barbeariaSnap.data();
      if (dados.configHorarios) {
        configHorariosBarbearia = dados.configHorarios;
        return;
      }
    }
  } catch (err) {
    console.error('Erro ao carregar configuração de horários:', err);
  }

  // Fallback para defaults se não existir configuração
  configHorariosBarbearia = {
    abertura: '09:00',
    fecho: '18:00',
    intervaloMinutos: 60,
    pausaInicio: '',
    pausaFim: ''
  };
}

// Preenche o select de horas, saltando as horas ocupadas se fornecidas
async function preencherHoras(horasOcupadas = []) {
  if (!horaSelect) return;
  horaSelect.innerHTML = '<option value="">Escolhe uma hora</option>';
  const horarios = gerarSlotsHorario(configHorariosBarbearia);

  const hoje = new Date();
  const dataHojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  let disponiveis = horarios.filter((h) => !(horasOcupadas || []).includes(h));
  if (dataInput?.value === dataHojeStr) {
    const horaAtualStr = `${String(hoje.getHours()).padStart(2, '0')}:${String(hoje.getMinutes()).padStart(2, '0')}`;
    disponiveis = disponiveis.filter((h) => h > horaAtualStr);
  }
  if (!disponiveis || disponiveis.length === 0) {
    // nenhuma hora livre
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Sem horas disponíveis neste dia';
    opt.disabled = true;
    horaSelect.appendChild(opt);
    if (agendarSubmitBtn) agendarSubmitBtn.disabled = true;
    return;
  }

  disponiveis.forEach((hora) => criarOpcao(horaSelect, hora, hora));
  if (agendarSubmitBtn) agendarSubmitBtn.disabled = false;
}

// Obtém horas já ocupadas na data (status pendente ou confirmada)
async function obterHorasOcupadas(data) {
  try {
    if (!data) return [];
    const conv = collection(db, 'marcacoes');
    const q = query(
      conv,
      where('barbeariaId', '==', BARBEARIA_ID),
      where('data', '==', data),
      where('status', 'in', ['pendente', 'confirmada'])
    );
    const snap = await getDocs(q);
    if (snap.empty) return [];
    const horas = snap.docs.map((d) => d.data()?.hora).filter(Boolean);
    return horas;
  } catch (err) {
    console.error('Erro ao obter horas ocupadas:', err);
    return [];
  }
}

// Lê o limite de marcações por cliente a partir do documento da barbearia,
// com fallback para LIMITE_MARCACOES_ATIVAS.
async function obterLimiteMarcacoes() {
  try {
    const barbeariaRef = doc(db, 'barbearias', BARBEARIA_ID);
    const barbeariaSnap = await getDoc(barbeariaRef);
    if (barbeariaSnap.exists()) {
      const dados = barbeariaSnap.data();
      const limite = dados?.limiteMarcacoesPorCliente;
      if (typeof limite === 'number' && limite > 0) return limite;
    }
  } catch (err) {
    console.error('Erro ao obter limite de marcações da barbearia:', err);
  }
  return LIMITE_MARCACOES_ATIVAS;
}

async function carregarServicos() {
  if (!servicoSelect) return;

  try {
    const barbeariaRef = doc(db, 'barbearias', BARBEARIA_ID);
    const barbeariaSnap = await getDoc(barbeariaRef);

    servicoSelect.innerHTML = '<option value="">Escolhe um serviço</option>';

    if (barbeariaSnap.exists()) {
      const dados = barbeariaSnap.data();
      const horarioFuncionamento = dados?.horarioFuncionamento;

      preencherHorarioInfo(horarioFuncionamento);
    }

    const servicosQuery = query(
      collection(db, 'barbearias', BARBEARIA_ID, 'servicos'),
      where('ativo', '==', true),
      orderBy('nome')
    );
    const servicosSnap = await getDocs(servicosQuery);

    if (!servicosSnap.empty) {
      servicosSnap.forEach((documento) => {
        const servico = documento.data();
        const nome = servico.nome || '';
        const preco = Number(servico.preco || 0);
        criarOpcao(
          servicoSelect,
          `${nome} — ${preco.toFixed(2).replace('.', ',')} €`,
          nome
        );
      });
      return;
    }

    preencherHorarioInfo(null);
    servicoSelect.innerHTML = '<option value="" disabled>Nenhum serviço disponível de momento</option>';
  } catch (erro) {
    console.error('Erro ao carregar serviços:', erro);
    servicoSelect.innerHTML = '<option value="">Erro ao carregar serviços</option>';
  }
}

function configurarDataMinima() {
  if (!dataInput) return;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  dataInput.min = `${ano}-${mes}-${dia}`;

  const limite = new Date();
  limite.setDate(limite.getDate() + LIMITE_DIAS_ANTECEDENCIA);
  const anoMax = limite.getFullYear();
  const mesMax = String(limite.getMonth() + 1).padStart(2, '0');
  const diaMax = String(limite.getDate()).padStart(2, '0');
  dataInput.max = `${anoMax}-${mesMax}-${diaMax}`;
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
  if (agendarSubmitBtn?.disabled) return;
  if (agendarSubmitBtn) agendarSubmitBtn.disabled = true;

  let { servico, data, hora, nome, telefone } = obterValoresMarcacao();

  // Em edição, mantém os valores originais caso o dropdown personalizado ainda
  // não tenha sincronizado o select nativo usado pela validação.
  if (marcacaoEditId) {
    servico = servico || marcacaoServicoOriginal || '';
    data = data || marcacaoDataOriginal || '';
    hora = hora || marcacaoHoraOriginal || '';
  }

  // validações obrigatórias comuns
  if (!servico || !data || !hora) {
    mostrarFeedback('Escolhe serviço, data e hora.', 'erro', feedbackAgendar || feedback);
    return;
  }

  const elementoFeedback = feedbackAgendar || feedback;

  // Se os campos de nome/telefone estão presentes no DOM, valida-os explicitamente aqui.
  if (nomeInput || telefoneInput) {
    if (!nome || !validarTelefonePT(telefone)) {
      mostrarFeedback('Preenche todos os campos corretamente.', 'erro', elementoFeedback);
      return;
    }
  } else {
    // Página agendar: confiamos nos dados já carregados em perfilDados. Se o telefone
    // do perfil estiver ausente ou inválido, pedimos ao utilizador para completar o perfil.
    if (!perfilDados.telefone || !validarTelefonePT(perfilDados.telefone)) {
      if (!elementoFeedback) return;
      elementoFeedback.innerHTML = 'Completa o teu perfil antes de agendar. <a href="./perfil.html?voltar=agendar">Editar perfil</a>';
      elementoFeedback.className = 'feedback erro';
      return;
    }
    // Também garante que o nome do perfil exista
    if (!perfilDados.nome) {
      if (!elementoFeedback) return;
      elementoFeedback.innerHTML = 'Completa o teu perfil antes de agendar (nome em falta). <a href="./perfil.html?voltar=agendar">Editar perfil</a>';
      elementoFeedback.className = 'feedback erro';
      return;
    }
  }

  const usuario = auth.currentUser;
  if (!usuario) {
    window.location.href = './login.html';
    return;
  }

  try {
    if (marcacaoEditId) {
      const dadosParaAtualizar = { servico, data, hora };
      if (marcacaoDataOriginal && data !== marcacaoDataOriginal) {
        dadosParaAtualizar.status = 'adiada';
      }
      await updateDoc(doc(db, 'marcacoes', marcacaoEditId), dadosParaAtualizar);

      const userRef = doc(db, 'utilizadores', usuario.uid);
      await updateDoc(userRef, {
        nome,
        telefone
      });

      if (nomePerfil) nomePerfil.textContent = nome;
      if (profileChipName) profileChipName.textContent = nome;
      if (telefonePerfil) telefonePerfil.textContent = `+351 ${telefone}`;
      if (telefonePerfilReadOnly) telefonePerfilReadOnly.textContent = telefone;

      const mensagemSucesso = dadosParaAtualizar.status === 'adiada'
        ? 'Marcação adiada com sucesso. Vais encontrá-la em "Histórico".'
        : 'Marcação atualizada com sucesso.';
      mostrarFeedback(mensagemSucesso, 'sucesso', feedbackAgendar || feedback);
      form?.reset();
      agendarForm?.reset();
      setTimeout(() => { window.location.href = './home.html'; }, 900);
      return;
    }

    // Verifica o limite de marcações ativas do cliente antes de criar uma nova
    const limite = await obterLimiteMarcacoes();
    try {
      const qAtivas = query(
        collection(db, 'marcacoes'),
        where('clienteId', '==', usuario.uid),
        where('barbeariaId', '==', BARBEARIA_ID),
        where('status', 'in', ['pendente', 'confirmada'])
      );
      const snapAtivas = await getDocs(qAtivas);
      if (snapAtivas.size >= limite) {
        const elementoFeedback = feedbackAgendar || feedback;
        if (elementoFeedback) {
          elementoFeedback.innerHTML = `Já tens ${snapAtivas.size} marcações ativas. Cancela ou aguarda a conclusão de uma antes de criar outra.`;
          elementoFeedback.className = 'feedback erro';
        }
        return;
      }

      if (!marcacaoEditId) {
        const jaTemNesseDia = snapAtivas.docs.some((d) => d.data()?.data === data);
        if (jaTemNesseDia) {
          const elementoFeedback = feedbackAgendar || feedback;
          if (elementoFeedback) {
            elementoFeedback.innerHTML = 'Já tens uma marcação ativa nesse dia. Edita essa marcação em vez de criar outra.';
            elementoFeedback.className = 'feedback erro';
          }
          return;
        }
      }
    } catch (errCheck) {
      console.error('Erro ao verificar marcações ativas:', errCheck);
      // segue em frente se a verificação falhar (não bloqueia o registo)
    }

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

    // Atualiza várias localizações possíveis do nome/telefone na UI
    if (nomePerfil) nomePerfil.textContent = nome;
    if (profileChipName) profileChipName.textContent = nome;
    if (telefonePerfil) telefonePerfil.textContent = `+351 ${telefone}`;
    if (telefonePerfilReadOnly) telefonePerfilReadOnly.textContent = telefone;

    mostrarFeedback('Marcação criada! Receberás notificações quando for atualizada.', 'sucesso', feedbackAgendar || feedback);
    form?.reset();
    agendarForm?.reset();
    setTimeout(() => { window.location.href = './home.html'; }, 900);
    // Recarrega disponibilidade para a data selecionada
    try {
      const horasOcupadas = await obterHorasOcupadas(data);
      await preencherHoras(horasOcupadas);
    } catch (e) {
      // fallback: preenche sem filtro
      await preencherHoras();
    }
  } catch (erro) {
    console.error('Erro ao criar marcação:', erro);
    mostrarFeedback('Não foi possível criar a marcação. Tenta novamente mais tarde.', 'erro');
  } finally {
    const temHorasDisponiveis = !!horaSelect && [...horaSelect.options].some((opt) => !opt.disabled && opt.value !== '');
    if (agendarSubmitBtn && temHorasDisponiveis) {
      agendarSubmitBtn.disabled = false;
    }
  }
}

async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service worker não suportado neste navegador.');
    return;
  }

  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' });
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
  const anoAtualEl = document.getElementById('anoAtual');
  if (anoAtualEl) anoAtualEl.textContent = new Date().getFullYear();

  const apoioForm = document.getElementById('apoioForm');
  apoioForm?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const feedbackApoio = document.getElementById('feedbackApoio');
    if (!feedbackApoio) return;

    try {
      const resposta = await fetch(apoioForm.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(apoioForm)
      });

      if (!resposta.ok) {
        throw new Error('Falha ao enviar');
      }

      feedbackApoio.textContent = 'Mensagem enviada! Responderemos em breve.';
      feedbackApoio.className = 'feedback sucesso';
      apoioForm.reset();
      setTimeout(() => {
        window.location.href = './home.html';
      }, 1200);
    } catch (err) {
      console.error('Erro ao enviar mensagem de apoio:', err);
      feedbackApoio.textContent = 'Não foi possível enviar. Tenta novamente.';
      feedbackApoio.className = 'feedback erro';
    }
  });

  await registrarServiceWorker();
  configurarDataMinima();
  await carregarConfigHorarios();
  preencherHoras();
  await carregarServicos();

  try {
    const params = new URLSearchParams(window.location.search);
    marcacaoEditId = params.get('id');
  } catch (e) {
    marcacaoEditId = null;
  }

  // Inicializa dropdowns customizados para a página de agendar (se existirem)
  try {
    createDropdown('servicoAgendar');
    createDropdown('horaAgendar');
  } catch (e) {
    // silencioso
  }

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

      // Verificar se existe um convite pendente para este telefone e barbearia
      try {
        if (perfilDados.telefone) {
          const convitesRef = collection(db, 'convitesFuncionario');
          const q = query(
            convitesRef,
            where('barbeariaId', '==', BARBEARIA_ID),
            where('telefoneConvidado', '==', perfilDados.telefone),
            where('status', '==', 'pendente')
          );
          const convitesSnap = await getDocs(q);
          if (!convitesSnap.empty) {
            // Mostrar banner ao utilizador com opção de aceitar
            const conviteDoc = convitesSnap.docs[0];
            showInviteBanner(conviteDoc.id);
          }
        }
      } catch (err) {
        console.error('Erro ao verificar convites:', err);
      }

      // Carregar as marcações do utilizador e popular as listas (próximas e histórico)
      try {
        await carregarMarcacoesUsuario(usuario.uid);
      } catch (err) {
        console.error('Erro ao carregar marcações do utilizador:', err);
      }

      if (agendarForm && marcacaoEditId) {
        try {
          const marcRef = doc(db, 'marcacoes', marcacaoEditId);
          const marcSnap = await getDoc(marcRef);
          if (!marcSnap.exists()) {
            mostrarFeedback('Marcação não encontrada.', 'erro', feedbackAgendar || feedback);
          } else {
            const dadosMarc = marcSnap.data();
            marcacaoDataOriginal = dadosMarc.data || null;
            marcacaoServicoOriginal = dadosMarc.servico || null;
            marcacaoHoraOriginal = dadosMarc.hora || null;
            if (dadosMarc.clienteId !== usuario.uid) {
              mostrarFeedback('Marcação não encontrada.', 'erro', feedbackAgendar || feedback);
            } else {
              if (servicoSelect) {
                servicoSelect.value = dadosMarc.servico || '';
                servicoSelect.dispatchEvent(new Event('change'));
              }
              if (dataInput) {
                dataInput.value = dadosMarc.data || '';
                dataInput.dispatchEvent(new Event('change'));
              }

              const conv = collection(db, 'marcacoes');
              const qh = query(
                conv,
                where('barbeariaId', '==', BARBEARIA_ID),
                where('data', '==', dadosMarc.data),
                where('status', 'in', ['pendente', 'confirmada'])
              );
              const snapH = await getDocs(qh);
              const horas = snapH.docs
                .filter((d) => d.id !== marcacaoEditId)
                .map((d) => d.data()?.hora)
                .filter(Boolean);
              await preencherHoras(horas);
              if (horaSelect) {
                horaSelect.value = dadosMarc.hora || '';
                horaSelect.dispatchEvent(new Event('change'));
              }

              // Garante que os valores originais permanecem selecionados após
              // a reconstrução dos horários e dos dropdowns personalizados.
              if (servicoSelect) {
                servicoSelect.value = dadosMarc.servico || '';
                servicoSelect.dispatchEvent(new Event('change'));
              }
              if (dataInput) dataInput.value = dadosMarc.data || '';

              bloquearEdicaoOuCancelamentoSeProximaHora(dadosMarc);

              agendarTitulo && (agendarTitulo.textContent = 'Editar marcação');
              if (agendarSubmitBtn) {
                agendarSubmitBtn.textContent = 'Atualizar marcação';
              }
              cancelarMarcacaoBtn?.classList.remove('hidden');
            }
          }
        } catch (err) {
          console.error('Erro ao carregar marcação para edição:', err);
          mostrarFeedback('Não foi possível carregar a marcação para edição.', 'erro', feedbackAgendar || feedback);
        }
      }

      // Quando o campo de data muda, atualiza horas disponíveis
      dataInput?.addEventListener('change', async (e) => {
        const dataEscolhida = e.target.value;
        if (!dataEscolhida) {
          // sem data: preenche todas as horas
          await preencherHoras();
          return;
        }

        // mostra estado temporário e desativa submit
        if (horaSelect) {
          horaSelect.innerHTML = '<option> A verificar disponibilidade... </option>';
        }
        if (agendarSubmitBtn) agendarSubmitBtn.disabled = true;

        const horasOcupadas = await obterHorasOcupadas(dataEscolhida);
        await preencherHoras(horasOcupadas);
      });
    } catch (erro) {
      console.error('Erro a verificar role no home:', erro);
      window.location.href = './login.html';
    }
  });

  form?.addEventListener('submit', registrarMarcacao);
  agendarForm?.addEventListener('submit', registrarMarcacao);
  cancelarMarcacaoBtn?.addEventListener('click', async () => {
    const ok = confirm('Tens a certeza que queres cancelar esta marcação?');
    if (!ok || !marcacaoEditId) return;

    try {
      const marcSnap = await getDoc(doc(db, 'marcacoes', marcacaoEditId));
      const dadosMarc = marcSnap.exists() ? marcSnap.data() : null;

      if (dadosMarc && bloquearEdicaoOuCancelamentoSeProximaHora(dadosMarc)) {
        return;
      }

      await updateDoc(doc(db, 'marcacoes', marcacaoEditId), { status: 'cancelada' });
      mostrarFeedback('Marcação cancelada.', 'sucesso', feedbackAgendar || feedback);
      setTimeout(() => { window.location.href = './home.html'; }, 900);
    } catch (err) {
      console.error('Erro ao cancelar marcação:', err);
      mostrarFeedback('Erro ao cancelar marcação.', 'erro', feedbackAgendar || feedback);
    }
  });
  perfilForm?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const voltarPara = params.get('voltar');
    const nome = nomePerfilInput?.value.trim();
    const arquivo = avatarFileInput?.files?.[0] || null;

    if (!nome) {
      mostrarFeedback('Preenche o nome corretamente.', 'erro', feedbackPerfil);
      return;
    }

    try {
      const usuario = auth.currentUser;
      if (!usuario) {
        window.location.href = './login.html';
        return;
      }

      mostrarFeedback('A carregar imagem...', 'subtle', feedbackPerfil);

      let avatarUrl = perfilDados.avatarUrl || '';
      if (arquivo) {
        try {
          avatarUrl = await uploadImageToCloudinary(arquivo);
        } catch (err) {
          console.error('Erro upload Cloudinary:', err);
          mostrarFeedback('Erro ao carregar a imagem. Tenta novamente.', 'erro', feedbackPerfil);
          return;
        }
      }

      const userRef = doc(db, 'utilizadores', usuario.uid);
      await updateDoc(userRef, {
        nome,
        avatarUrl
      });

      perfilDados = { ...perfilDados, nome, avatarUrl };
      aplicarDadosPerfil(perfilDados);
      mostrarFeedback('Perfil atualizado com sucesso.', 'sucesso', feedbackPerfil);
      const destino = voltarPara === 'agendar' ? './agendar.html' : './home.html';
      setTimeout(() => { window.location.href = destino; }, 900);
    } catch (erro) {
      console.error('Erro ao atualizar perfil:', erro);
      mostrarFeedback('Não foi possível atualizar o perfil.', 'erro', feedbackPerfil);
    }
  });
  btnNotificacoes?.addEventListener('click', pedirPermissaoNotificacoes);
  // logout: suporta o botão antigo e o novo dropdown
  btnLogout?.addEventListener('click', async () => {
    // Confirma o logout antes de terminar a sessão do cliente.
    if (!confirm('Tens a certeza que queres sair?')) {
      return;
    }
    await signOut(auth);
    window.location.href = './login.html';
  });
  dropdownLogout?.addEventListener('click', async () => {
    // Confirma o logout também quando é feito pelo menu do perfil.
    if (!confirm('Tens a certeza que queres sair?')) {
      return;
    }
    await signOut(auth);
    window.location.href = './login.html';
  });

  // Toggle do chip de perfil (pequeno)
  profileChipButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown?.classList.toggle('open');
    profileChipButton.setAttribute('aria-expanded', profileDropdown?.classList.contains('open') ? 'true' : 'false');
  });
  document.addEventListener('click', () => profileDropdown?.classList.remove('open'));

  // Mantém compatibilidade com o toggle anterior se existir
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

  // Preview de avatar quando selecionar ficheiro
  avatarFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      avatarPreview.innerHTML = '';
      return;
    }
    const url = URL.createObjectURL(file);
    avatarPreview.innerHTML = `<img src="${url}" alt="Pré-visualização"/>`;
  });
});

async function uploadImageToCloudinary(file) {
  const CLOUD_NAME = 'vwlu9kjl';
  const UPLOAD_PRESET = 'marcacao_avatares';

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(url, { method: 'POST', body: fd });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upload falhou: ${txt}`);
  }
  const data = await res.json();
  return data.secure_url;
}

// Mostra o banner de convite e liga ações
function showInviteBanner(conviteId) {
  if (!inviteBanner) return;
  inviteBanner.style.display = 'block';

  const aceitar = async () => {
    try {
      // Atualiza o convite para aceite e promove o utilizador
      await updateDoc(doc(db, 'convitesFuncionario', conviteId), { status: 'aceite' });
      const usuario = auth.currentUser;
      if (!usuario) {
        window.location.href = './login.html';
        return;
      }
      const userRef = doc(db, 'utilizadores', usuario.uid);
      await updateDoc(userRef, { role: 'funcionario' });
      // Redireciona para painel
      window.location.href = './painel.html';
    } catch (err) {
      console.error('Erro ao aceitar convite:', err);
      mostrarFeedback('Não foi possível aceitar o convite. Tenta novamente.', 'erro', feedbackPerfil);
    }
  };

  const adiar = () => {
    // Esconder o banner apenas esta sessão
    inviteBanner.style.display = 'none';
  };

  inviteAcceptBtn?.removeEventListener('click', aceitar);
  inviteLaterBtn?.removeEventListener('click', adiar);
  inviteAcceptBtn?.addEventListener('click', aceitar);
  inviteLaterBtn?.addEventListener('click', adiar);
}

// Carrega e renderiza as marcações do utilizador autenticado
async function carregarMarcacoesUsuario(uid) {
  if (!uid) return;
  if (!upcomingList || !historyList) return;

  upcomingList.innerHTML = '';
  historyList.innerHTML = '';

  const q = query(collection(db, 'marcacoes'), where('clienteId', '==', uid), where('barbeariaId', '==', BARBEARIA_ID));
  const snap = await getDocs(q);
  if (snap.empty) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'table-row';
    emptyMsg.textContent = 'Ainda não tens marcações. Marca já o teu primeiro corte.';
    upcomingList.appendChild(emptyMsg);
    return;
  }

  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

  // Carregar nomes dos funcionários referenciados (cache)
  const funcIds = [...new Set(items.filter((i) => i.funcionarioId).map((i) => i.funcionarioId))];
  const funcMap = {};
  await Promise.all(
    funcIds.map(async (fid) => {
      try {
        const s = await getDoc(doc(db, 'utilizadores', fid));
        funcMap[fid] = s.exists() ? s.data().nome || 'Funcionário' : 'Barbearia Feitosa';
      } catch (e) {
        funcMap[fid] = 'Barbearia Feitosa';
      }
    })
  );

  // Normalizar datas para ordenação
  items.forEach((it) => {
    try {
      it._dt = new Date(`${it.data}T${it.hora}:00`);
    } catch (e) {
      it._dt = new Date();
    }
  });

  // Próximas: pendente ou confirmada (ascendente)
  const proximas = items
    .filter((it) => it.status === 'pendente' || it.status === 'confirmada')
    .sort((a, b) => a._dt - b._dt);

  // Histórico: concluidA, cancelada, adiada (descendente)
  const historico = items
    .filter((it) => ['concluida', 'cancelada', 'adiada'].includes(it.status))
    .sort((a, b) => b._dt - a._dt);
  const LIMITE_HISTORICO_VISIVEL = 4;

  function renderLista(container, list, isUpcoming = false) {
    container.innerHTML = '';
    if (!list || list.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'table-row';
      msg.textContent = 'Nenhuma marcação nesta lista.';
      container.appendChild(msg);
      return;
    }

    list.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'table-row';
      const performer = it.funcionarioId ? funcMap[it.funcionarioId] || 'Funcionário' : 'Barbearia Feitosa';
      const dtText = it.data && it.hora ? `${it.data} ${it.hora}` : 'Data/Hora não definida';
      const informacao = document.createElement('div');
      const badge = document.createElement('span');
      informacao.innerHTML = `<strong>${dtText}</strong><div>${it.servico} — ${performer}</div>`;
      badge.className = `status-tag ${it.status}`;
      badge.textContent = {
        pendente: 'Pendente',
        confirmada: 'Confirmada',
        concluida: 'Concluída',
        cancelada: 'Cancelada',
        adiada: 'Adiada'
      }[it.status] || it.status;
      row.append(informacao, badge);

      // Só adiciona listener/click para próximas marcações (pendente ou confirmada)
      if (isUpcoming && (it.status === 'pendente' || it.status === 'confirmada')) {
        const actions = document.createElement('div');
        actions.className = 'row-actions';

        const criarAcao = (texto, novoEstado, confirmarCancelamento = false) => {
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.className = 'btn btn-small';
          botao.textContent = texto;
          botao.addEventListener('click', async (evento) => {
            evento.stopPropagation();
            if (confirmarCancelamento && !confirm('Tens a certeza que queres cancelar esta marcação?')) return;
            await updateDoc(doc(db, 'marcacoes', it.id), { status: novoEstado });
            await carregarMarcacoesUsuario(uid);
          });
          return botao;
        };

        actions.appendChild(criarAcao('Cancelar', 'cancelada', true));
        const botaoEditar = document.createElement('button');
        botaoEditar.type = 'button';
        botaoEditar.className = 'btn btn-small';
        botaoEditar.textContent = 'Editar';
        botaoEditar.addEventListener('click', (evento) => {
          evento.stopPropagation();
          window.location.href = `./agendar.html?id=${it.id}`;
        });
        actions.appendChild(botaoEditar);
        row.appendChild(actions);
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
          window.location.href = `./agendar.html?id=${it.id}`;
        });
      }
      container.appendChild(row);
    });
  }

  renderLista(upcomingList, proximas, true);

  const historySection = historyList.parentElement;
  if (historySection) {
    const existingToggle = historySection.querySelector('[data-history-toggle]');
    if (existingToggle) existingToggle.remove();
  }

  renderLista(historyList, historico.slice(0, LIMITE_HISTORICO_VISIVEL), false);

  if (historico.length > LIMITE_HISTORICO_VISIVEL && historySection) {
    const btnVerMais = document.createElement('button');
    btnVerMais.type = 'button';
    btnVerMais.className = 'btn btn-secondary btn-compact';
    btnVerMais.dataset.historyToggle = 'true';
    btnVerMais.textContent = `Ver mais (${historico.length - LIMITE_HISTORICO_VISIVEL})`;
    btnVerMais.addEventListener('click', () => {
      renderLista(historyList, historico, false);
      btnVerMais.remove();
    });
    historySection.appendChild(btnVerMais);
  }
}
