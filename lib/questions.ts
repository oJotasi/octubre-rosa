// Server-only content: client components import types from lib/types instead.
export const QUESTION_SET_VERSION = "2026-10-v1";
export const QUESTIONS = [
  { id: "hombres", text: "¿El cáncer de mama puede afectar también a los hombres?", options: ["Sí.", "No.", "Solo a partir de los 80 años."], correct: 0, explanation: "Aunque es mucho menos frecuente, los hombres también pueden desarrollar cáncer de mama." },
  { id: "deteccion", text: "¿Por qué es importante detectar el cáncer de mama a tiempo?", options: ["Porque garantiza que nunca habrá tratamiento.", "Porque permite iniciar una evaluación y tratamiento oportunos.", "Porque elimina la necesidad de consultar al personal de salud."], correct: 1, explanation: "La detección temprana puede mejorar las opciones de atención y los resultados." },
  { id: "mes", text: "¿Qué mes se dedica internacionalmente a la concientización sobre el cáncer de mama?", options: ["Marzo.", "Julio.", "Octubre."], correct: 2, explanation: "Octubre se utiliza para difundir información y promover la concientización sobre el cáncer de mama." },
] as const;
export type OrderedQuestion = { id: string; order: number[] };
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
    let value: number;
    do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
    const j = value % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createQuestionOrder(): OrderedQuestion[] {
  return shuffle(QUESTIONS).map(q => ({ id: q.id, order: shuffle([0, 1, 2]) }));
}
export function officialQuestion(ordered: OrderedQuestion) {
  const question = QUESTIONS.find(q => q.id === ordered.id);
  if (!question) throw new Error("Unknown stored question");
  return question;
}
export function publicQuestions(questions: OrderedQuestion[]) {
  return questions.map(q => { const official = officialQuestion(q); return { id: q.id, text: official.text, options: q.order.map(i => official.options[i]) }; });
}
export function feedbackFor(question: OrderedQuestion, selectedIndex: number) {
  const official = officialQuestion(question); const correctIndex = question.order.indexOf(official.correct);
  return { selectedIndex, correctIndex, isCorrect: selectedIndex === correctIndex, explanation: official.explanation };
}
export function scoreAnswers(questions: OrderedQuestion[], answers: number[]) {
  if (answers.length !== 3 || answers.some(a => !Number.isInteger(a) || a < 0 || a > 2)) throw new Error("Invalid answers");
  const correctCount = questions.reduce((sum, q, i) => sum + Number(feedbackFor(q, answers[i]).isCorrect), 0);
  return { correctCount, isCorrect: correctCount === 3 };
}
