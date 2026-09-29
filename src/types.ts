export type Stage = "submission" | "moderation" | "judging" | "results";
export type Status = "moderation" | "published" | "rework" | "rejected" | "winner";
export type Score = { idea:number; english:number; originality:number; design:number; digital:number };
export type Submission = {
  id:string; posterNo:number; title:string; idea:string; problem:string;
  author:string; group:string; contact:string; tools:string; aiHow:string;
  contribution:string; interactive:boolean; interactiveUrl?:string;
  imageUrl?:string; status:Status; createdAt:string; audience:number;
};
export const criteria = [
  ["idea","Communication idea"],["english","English language"],["originality","Originality of concept"],
  ["design","Visual design"],["digital","Meaningful use of AI & digital technologies"]
] as const;