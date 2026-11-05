import { parseDay, type Day } from "./dates";

const VIBES = [
  "tudo no seu ritmo", "um dia de cada vez", "respira, vai dar certo", "hoje é uma página nova",
  "devagar também chega", "sem pressa, com carinho", "um passinho já conta", "o dia é seu",
];

const QUOTES = [
  "Um passo pequeno ainda é um passo.",
  "Feito com calma vale mais que feito com pressa.",
  "O que importa cabe num dia comum.",
  "Descansar também é seguir em frente.",
  "Comece pelo que dá para fazer agora.",
  "Dias simples também merecem uma página.",
  "A gentileza começa em como você fala consigo.",
  "Pouco a pouco, o caderno se enche.",
  "Nem todo dia rende, e tudo bem.",
  "O que você cuida, floresce.",
  "Um café, uma lista, um começo.",
  "Terminar pequeno é melhor que nunca começar.",
  "Seu ritmo não precisa ser o de ninguém.",
  "Hoje, escolha uma coisa só.",
  "Quem anota, lembra de si.",
  "A pressa passa; o que fica é o caminho.",
  "Abra espaço para o que faz bem.",
  "Toda página em branco é um convite.",
  "Agradecer deixa o dia maior.",
  "Faça o que puder, com o que tiver, onde estiver.",
  "Plantar hoje já é colher um pouco.",
  "A constância mora nas coisas pequenas.",
  "Um dia tranquilo também é uma conquista.",
  "Volte para si antes de voltar para a lista.",
  "O suficiente também é bonito.",
  "Sempre dá tempo de recomeçar a tarde.",
  "Celebre o que já deu certo.",
  "Às vezes a tarefa do dia é respirar.",
  "Boas histórias são escritas aos poucos.",
  "Cuide do hoje; o amanhã agradece.",
  "O que foi escrito já não pesa tanto.",
];

// O dia escolhe a frase, para ela ser a mesma em todos os aparelhos.
function indexFor(day: Day, length: number): number {
  const { y, m, d } = parseDay(day);
  return (y * 372 + m * 31 + d) % length;
}

export const vibeFor = (day: Day) => VIBES[indexFor(day, VIBES.length)] as string;
export const quoteFor = (day: Day) => QUOTES[indexFor(day, QUOTES.length)] as string;
