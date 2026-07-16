import { getPrisma, nowDate } from "./db";

export class DuplicateSiteInterestError extends Error {
  constructor() {
    super("Este e-mail já enviou um interesse para o IEEE UFJF.");
    this.name = "DuplicateSiteInterestError";
  }
}

export async function reserveSiteInterest({ email, interest, language, message, name }) {
  try {
    return await getPrisma().siteInterest.create({
      data: {
        email,
        interest,
        language,
        message,
        name,
        status: "pending",
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new DuplicateSiteInterestError();
    }

    throw error;
  }
}

export async function markSiteInterestSent(id) {
  return getPrisma().siteInterest.update({
    data: {
      sentAt: nowDate(),
      status: "sent",
    },
    where: { id },
  });
}

export async function releasePendingSiteInterest(id) {
  return getPrisma().siteInterest.deleteMany({
    where: {
      id,
      status: "pending",
    },
  });
}
