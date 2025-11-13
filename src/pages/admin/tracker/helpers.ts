import { trackerApi } from '../../../services/trackerApi';

export async function fetchQuestions() {
  const res = await trackerApi.getQuestions();
  return res?.categories ?? [];
}

export async function createCategory(payload: { title: string; description?: string }) {
  return trackerApi.addCategory(payload);
}

export async function patchCategory(
  categoryId: number,
  payload: { title?: string; description?: string }
) {
  return trackerApi.updateCategory(categoryId, payload);
}

export async function removeCategory(categoryId: number) {
  return trackerApi.deleteCategory(categoryId);
}

export async function createQuestion(payload: {
  category_id: number;
  text: string;
  type: string;
  options?: string[];
}) {
  return trackerApi.addQuestion(payload);
}

export async function patchQuestion(
  questionId: number,
  payload: { text?: string; type?: string; options?: string[] }
) {
  return trackerApi.updateQuestion(questionId, payload);
}

export async function removeQuestion(questionId: number) {
  return trackerApi.deleteQuestion(questionId);
}
