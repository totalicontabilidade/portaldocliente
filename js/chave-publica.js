/* ============================================================
   Totali · Portal do Cliente
   chave-publica.js — a chave PÚBLICA da Totali para o cofre de senhas

   Com ela o portal TRANCA; só a chave privada (Secret Manager,
   segredo `chave-privada-credenciais`) ABRE. Cole aqui o JWK
   público gerado no painel (Segurança › Gerar par de chaves) — ou
   o mesmo do Academy, se o projeto Firebase for compartilhado.

   Enquanto for null, o cofre avisa que o canal seguro não está
   configurado e não deixa guardar senha.
   ============================================================ */
window.CHAVE_PUBLICA = {
  "alg": "RSA-OAEP-256",
  "e": "AQAB",
  "ext": true,
  "key_ops": [
    "encrypt"
  ],
  "kty": "RSA",
  "n": "vvGT-voySO-OSBYQ_DRrMZHWqoQmgkRB09A7ysCUr7uXjOa7wCLYc7fXgfwFhAKVzVvnuB3QR25h1aogJ8UowNwuzaBE-U-P-xe_btU_7mSuuXuyD1wIqlIVhj-kc4afYcu_3Z6Y_cjX618zV0qqQCfhWV_oT-SsmTBXoD9FuMl_M-58dPmazcPe3qglrV8KcPgLgIjeejKmbcsPwhtLZowmxnGYlq5gzucT1Nk9iv11zMUA4oF_cq0vDA0e3B4kRg0ZYtcilfKuLocIApqNZF_gRMFi0G_w6SfOYCh0Cfe9MWJ66mRMpf2YpCNtrFGunTa2mDbT6E4uyucIxPsHMqP1qdhU7wHA40giG0SAzByVjwWxuI8TGH2-E1OF7s_B24um-PSgSjyletsyWXJqyHCX7oxfUjXqJYgLV0iIBIaCEHl0LzY4daKblHg7aQ5ijTWni8jrOlAdsBZIixe1GrNnX868nww6l60GGpT_H55-psu_FroamIjQ-rst1n4J"
};
