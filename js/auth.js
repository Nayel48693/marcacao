import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js';
import { auth, db, BARBEARIA_ID, serverTimestamp } from './firebase-config.js';
import { validarTelefonePT, senhasCoincidem, senhaForte } from './validacao.js';

function mostrarFeedback(elemento, mensagem, tipo = 'erro') {
  if (!elemento) return;

  elemento.textContent = mensagem;
  elemento.className = `feedback ${tipo}`;
}

function construirEmailFicticio(telefone) {
  return `${telefone}@marcacao.app`;
}

async function obterConviteFuncionario(telefone) {
  const convitesRef = collection(db, 'convitesFuncionario');
  const convitesQuery = query(
    convitesRef,
    where('barbeariaId', '==', BARBEARIA_ID),
    where('telefoneConvidado', '==', telefone),
    where('status', '==', 'aceite')
  );
  const convitesSnap = await getDocs(convitesQuery);
  return !convitesSnap.empty;
}

export async function registarUtilizador(telefone, senha) {
  const telefoneLimpo = telefone.replace(/\s|-/g, '');
  const elementoFeedback = document.getElementById('feedbackRegisto');

  if (!validarTelefonePT(telefoneLimpo)) {
    mostrarFeedback(elementoFeedback, 'Telefone inválido. Usa 9 dígitos válidos.', 'erro');
    return { sucesso: false };
  }

  if (!senhaForte(senha)) {
    mostrarFeedback(elementoFeedback, 'A senha deve ter pelo menos 6 caracteres.', 'erro');
    return { sucesso: false };
  }

  if (!senhasCoincidem(senha, document.getElementById('confirmarSenhaRegisto')?.value ?? '')) {
    mostrarFeedback(elementoFeedback, 'As senhas não coincidem.', 'erro');
    return { sucesso: false };
  }

  try {
    const emailFicticio = construirEmailFicticio(telefoneLimpo);
    const credenciais = await createUserWithEmailAndPassword(auth, emailFicticio, senha);
    const invitationAccepted = await obterConviteFuncionario(telefoneLimpo);
    const role = invitationAccepted ? 'funcionario' : 'cliente';

    try {
      await setDoc(doc(db, 'utilizadores', credenciais.user.uid), {
        telefone: telefoneLimpo,
        role,
        barbeariaId: BARBEARIA_ID,
        criadoEm: serverTimestamp()
      });

      mostrarFeedback(elementoFeedback, 'Conta criada com sucesso! A carregar a home...', 'sucesso');
      window.location.href = 'home.html';
      return { sucesso: true, uid: credenciais.user.uid };
    } catch (firestoreErro) {
      console.error('Erro Firestore utilizador:', firestoreErro);

      try {
        await credenciais.user.delete();
      } catch (deleteErro) {
        console.error('Erro ao remover utilizador auth após falha Firestore:', deleteErro);
      }

      const mensagem = firestoreErro?.code?.startsWith('permission-denied')
        ? 'Não foi possível gravar os dados do utilizador no Firestore. Verifica as regras de segurança.'
        : firestoreErro?.message || 'O utilizador foi criado, mas não foi possível completar o registo. Tenta novamente.';

      mostrarFeedback(elementoFeedback, mensagem, 'erro');
      return { sucesso: false, erro: firestoreErro };
    }
  } catch (erro) {
    console.error('Erro Firebase registo:', erro);
    let mensagem = 'Ocorreu um erro ao criar a conta.';

    if (erro?.code === 'auth/email-already-in-use') {
      mensagem = 'Este número já está registado.';
    } else if (erro?.code === 'auth/weak-password') {
      mensagem = 'A senha é demasiado fraca.';
    } else if (erro?.code === 'auth/invalid-email') {
      mensagem = 'Telefone inválido.';
    } else if (erro?.code === 'auth/operation-not-allowed') {
      mensagem = 'A autenticação por email não está ativada no Firebase.';
    } else if (erro?.message) {
      mensagem = erro.message;
    }

    mostrarFeedback(elementoFeedback, mensagem, 'erro');
    return { sucesso: false, erro };
  }
}

export async function loginUtilizador(telefone, senha) {
  const elementoFeedback = document.getElementById('feedbackLogin');
  const telefoneLimpo = telefone.replace(/\s|-/g, '');

  try {
    const emailFicticio = construirEmailFicticio(telefoneLimpo);
    const credenciais = await signInWithEmailAndPassword(auth, emailFicticio, senha);

    const utilizadorRef = doc(db, 'utilizadores', credenciais.user.uid);
    let utilizadorDoc = await getDoc(utilizadorRef);
    let dados = utilizadorDoc.data();

    if (!utilizadorDoc.exists()) {
      const invitationAccepted = await obterConviteFuncionario(telefoneLimpo);
      if (invitationAccepted) {
        await setDoc(utilizadorRef, {
          telefone: telefoneLimpo,
          role: 'funcionario',
          barbeariaId: BARBEARIA_ID,
          criadoEm: serverTimestamp()
        });
        dados = { role: 'funcionario' };
      }
    }

    if (dados?.role === 'admin' || dados?.role === 'funcionario') {
      window.location.href = '../pages/painel.html';
    } else {
      window.location.href = '../pages/home.html';
    }

    return { sucesso: true };
  } catch (erro) {
    console.error('Erro Firebase login:', erro);
    let mensagem = 'Ocorreu um erro ao entrar.';

    if (erro?.code === 'auth/wrong-password' || erro?.code === 'auth/user-not-found') {
      mensagem = 'Telefone ou senha incorretos.';
    } else if (erro?.code === 'auth/invalid-email') {
      mensagem = 'Telefone inválido.';
    } else if (erro?.code === 'auth/user-disabled') {
      mensagem = 'A conta está desativada.';
    } else if (erro?.code === 'auth/too-many-requests') {
      mensagem = 'Muitas tentativas. Tenta novamente mais tarde.';
    }

    mostrarFeedback(elementoFeedback, mensagem, 'erro');
    return { sucesso: false, erro };
  }
}

// Lógica de UI para o formulário de registo.
document.addEventListener('DOMContentLoaded', () => {
  const registoForm = document.getElementById('registoForm');
  const loginForm = document.getElementById('loginForm');
  const btnProximo = document.getElementById('btnProximo');
  const telefoneRegisto = document.getElementById('telefoneRegisto');
  const senhaRegisto = document.getElementById('senhaRegisto');
  const confirmarSenhaRegisto = document.getElementById('confirmarSenhaRegisto');
  const feedbackSenha = document.getElementById('feedbackSenha');
  const feedbackRegisto = document.getElementById('feedbackRegisto');

  const passos = Array.from(document.querySelectorAll('.step'));
  const paineis = Array.from(document.querySelectorAll('.step-panel'));

  if (btnProximo) {
    btnProximo.addEventListener('click', () => {
      const telefone = telefoneRegisto?.value || '';
      if (!validarTelefonePT(telefone.replace(/\s|-/g, ''))) {
        mostrarFeedback(feedbackRegisto, 'Telefone inválido. Usa 9 dígitos válidos.', 'erro');
        return;
      }

      passos.forEach((passo) => passo.classList.toggle('active', passo.dataset.step === '2'));
      paineis.forEach((painel) => painel.classList.toggle('active', painel.dataset.panel === '2'));
    });
  }

  function atualizarFeedbackSenha() {
    const senha = senhaRegisto?.value || '';
    const confirmar = confirmarSenhaRegisto?.value || '';

    if (!senha && !confirmar) {
      feedbackSenha.textContent = '';
      feedbackSenha.className = 'feedback subtle';
      return;
    }

    if (!senhaForte(senha)) {
      feedbackSenha.textContent = 'A senha deve ter pelo menos 6 caracteres.';
      feedbackSenha.className = 'feedback erro';
      return;
    }

    if (confirmar && !senhasCoincidem(senha, confirmar)) {
      feedbackSenha.textContent = 'As senhas ainda não coincidem.';
      feedbackSenha.className = 'feedback erro';
    } else if (confirmar && senhasCoincidem(senha, confirmar)) {
      feedbackSenha.textContent = 'As senhas coincidem.';
      feedbackSenha.className = 'feedback sucesso';
    }
  }

  [senhaRegisto, confirmarSenhaRegisto].forEach((campo) => {
    campo?.addEventListener('input', atualizarFeedbackSenha);
  });

  if (registoForm) {
    registoForm.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const telefone = telefoneRegisto?.value || '';
      const senha = senhaRegisto?.value || '';
      const confirmarSenha = confirmarSenhaRegisto?.value || '';

      if (!validarTelefonePT(telefone.replace(/\s|-/g, ''))) {
        mostrarFeedback(feedbackRegisto, 'Telefone inválido. Usa 9 dígitos válidos.', 'erro');
        return;
      }

      if (!senhaForte(senha)) {
        mostrarFeedback(feedbackRegisto, 'A senha deve ter pelo menos 6 caracteres.', 'erro');
        return;
      }

      if (!senhasCoincidem(senha, confirmarSenha)) {
        mostrarFeedback(feedbackRegisto, 'As senhas não coincidem.', 'erro');
        return;
      }

      await registarUtilizador(telefone, senha);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const telefone = document.getElementById('telefoneLogin')?.value || '';
      const senha = document.getElementById('senhaLogin')?.value || '';

      if (!validarTelefonePT(telefone.replace(/\s|-/g, ''))) {
        mostrarFeedback(document.getElementById('feedbackLogin'), 'Telefone inválido. Usa 9 dígitos válidos.', 'erro');
        return;
      }

      await loginUtilizador(telefone, senha);
    });
  }
});
