// src/utils/cidadesSC.js

const listaBruta = [
  "Abdon Batista", "Abelardo Luz", "Agrolândia", "Agronômica", "Água Doce", 
  "Águas de Chapecó", "Águas Frias", "Águas Mornas", "Alfredo Wagner", 
  "Alto Bela Vista", "Anchieta", "Angelina", "Anita Garibaldi", "Anitápolis", 
  "Antônio Carlos", "Apiúna", "Arabutã", "Araranguá", "Araquari", "Arroio Trinta", 
  "Arvoredo", "Ascurra", "Atalanta", "Aurora", "Balneário Arroio do Silva", 
  "Balneário Barra do Sul", "Balneário Camboriú", "Balneário Gaivota", 
  "Balneário Piçarras", "Balneário Rincão", "Bandeirante", "Barra Bonita", 
  "Barra Velha", "Bela Vista do Toldo", "Belmonte", "Benedito Novo", "Biguaçu", 
  "Blumenau", "Bocaina do Sul", "Bom Jardim da Serra", "Bom Jesus", 
  "Bom Jesus do Oeste", "Bom Retiro", "Bombinhas", "Botuverá", "Braço do Norte", 
  "Braço do Trombudo", "Brunópolis", "Brusque", "Caçador", "Caibi", "Calmon", 
  "Camboriú", "Campo Alegre", "Campo Belo do Sul", "Campo Erê", "Campos Novos", 
  "Canelinha", "Canoinhas", "Capão Alto", "Capinzal", "Capivari de Baixo", 
  "Catanduvas", "Caxambu do Sul", "Celso Ramos", "Cerro Negro", "Chapecó", 
  "Chapadão do Lageado", "Cocal do Sul", "Concórdia", "Cordilheira Alta", 
  "Coronel Freitas", "Coronel Martins", "Corupá", "Correia Pinto", "Criciúma", 
  "Cunha Porã", "Cunhataí", "Curitibanos", "Descanso", "Dionísio Cerqueira", 
  "Dona Emma", "Doutor Pedrinho", "Entre Rios", "Erval Velho", "Ermo", 
  "Faxinal dos Guedes", "Flor do Sertão", "Florianópolis", "Forquilhinha", 
  "Formosa do Sul", "Fraiburgo", "Frei Rogério", "Galvão", "Garopaba", "Garuva", 
  "Gaspar", "Governador Celso Ramos", "Grão Pará", "Gravatal", "Guabiruba", 
  "Guaraciaba", "Guarujá do Sul", "Guaramirim", "Guatambu", "Herval d'Oeste", 
  "Ibiam", "Ibicaré", "Ibirama", "Içara", "Ilhota", "Imaruí", "Imbituba", 
  "Imbuia", "Indaial", "Iomerê", "Ipira", "Iporã do Oeste", "Ipuaçu", "Ipumirim", 
  "Iraceminha", "Irani", "Irati", "Irineópolis", "Itá", "Itajaí", "Itapema", 
  "Itapiranga", "Itapoá", "Ituporanga", "Itaiópolis", "Jaborá", "Jacinto Machado", 
  "Jaguaruna", "Jardinópolis", "Jaraguá do Sul", "Joaçaba", "Joinville", 
  "José Boiteux", "Jupiá", "Lacerdópolis", "Lages", "Lajeado Grande", 
  "Laurentino", "Lauro Müller", "Lebon Régis", "Leoberto Leal", "Lindóia do Sul", 
  "Lontras", "Luiz Alves", "Luzerna", "Macieira", "Mafra", "Major Gercino", 
  "Major Vieira", "Maracajá", "Maravilha", "Marema", "Massaranduba", "Matos Costa", 
  "Meleiro", "Mirim Doce", "Modelo", "Mondaí", "Monte Carlo", "Monte Castelo", 
  "Morro da Fumaça", "Morro Grande", "Navegantes", "Nova Erechim", "Nova Itaberaba", 
  "Nova Trento", "Nova Veneza", "Novo Horizonte", "Orleans", "Otacílio Costa", 
  "Ouro", "Ouro Verde", "Paial", "Painel", "Palma Sola", "Palmeira", "Palmitos", 
  "Palhoça", "Papanduva", "Paraíso", "Passo de Torres", "Passos Maia", 
  "Paulo Lopes", "Pedras Grandes", "Penha", "Peritiba", "Pescaria Brava", 
  "Petrolândia", "Pinhalzinho", "Pinheiro Preto", "Piratuba", "Planalto Alegre", 
  "Pomerode", "Ponte Alta", "Ponte Alta do Norte", "Ponte Serrada", "Porto Belo", 
  "Porto União", "Pouso Redondo", "Praia Grande", "Presidente Castello Branco", 
  "Presidente Getúlio", "Presidente Nereu", "Princesa", "Quilombo", "Rancho Queimado", 
  "Rio das Antas", "Rio do Campo", "Rio do Oeste", "Rio do Sul", "Rio dos Cedros", 
  "Rio Fortuna", "Rio Negrinho", "Rio Rufino", "Riqueza", "Rodeio", "Romelândia", 
  "Salete", "Saltinho", "Salto Veloso", "Sangão", "Santa Cecília", "Santa Helena", 
  "Santa Rosa de Lima", "Santa Rosa do Sul", "Santa Terezinha", 
  "Santa Terezinha do Progresso", "Santiago do Sul", "Santo Amaro da Imperatriz", 
  "São Bernardino", "São Bento do Sul", "São Bonifácio", "São Carlos", 
  "São Cristóvão do Sul", "São Domingos", "São Francisco do Sul", 
  "São João Batista", "São João do Itaperiú", "São João do Oeste", 
  "São Joaquim", "São José", "São José do Cedro", "São José do Cerrito", 
  "São Lourenço do Oeste", "São Ludgero", "São Martinho", "São Miguel da Boa Vista", 
  "São Miguel do Oeste", "São Pedro de Alcântara", "Saudades", "Seara", 
  "Serra Alta", "Siderópolis", "Sombrio", "Sul Brasil", "Taió", "Tangará", 
  "Tigrinhos", "Tijucas", "Timbé do Sul", "Timbó", "Timbó Grande", 
  "Três Barras", "Treviso", "Treze de Maio", "Treze Tílias", "Trombudo Central", 
  "Tubarão", "Tunápolis", "Turvo", "União do Oeste", "Urubici", "Urupema", 
  "Urussanga", "Vargeão", "Vargem", "Vargem Bonita", "Vidal Ramos", 
  "Videira", "Vitor Meireles", "Witmarsum", "Xanxerê", "Xavantina", "Xaxim", "Zortéa"
];

// Função para remover acentos e deixar tudo maiúsculo
const formatarNomeCidade = (nome) => {
  return nome
    .normalize("NFD") 
    .replace(/[\u0300-\u036f]/g, "") 
    .toUpperCase();
};

// Mapeia, formata e ordena alfabeticamente
export const cidadesSC = listaBruta
  .map(formatarNomeCidade)
  .sort((a, b) => a.localeCompare(b));