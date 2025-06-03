export interface Choice {
  id: number;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  choices: Choice[];
  isOpen: boolean;
  hostId: string; // Socket ID of the host
  participants: Map<string, { name: string; votedChoiceId?: number }>;
}
