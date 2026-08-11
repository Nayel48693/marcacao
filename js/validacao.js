// Funções de validação reutilizáveis em todo o site.

export function validarTelefonePT(telefone) {
  if (typeof telefone !== 'string') {
    return false;
  }

  const telefoneLimpo = telefone.replace(/\s|-/g, '');
  return /^[239]\d{8}$/.test(telefoneLimpo);
}

export function senhasCoincidem(senha, confirmarSenha) {
  return typeof senha === 'string' && typeof confirmarSenha === 'string' && senha === confirmarSenha;
}

export function senhaForte(senha) {
  return typeof senha === 'string' && senha.length >= 6;
}
