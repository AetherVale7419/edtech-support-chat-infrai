import assert from "node:assert/strict";
import test from "node:test";
import { parseSupportRequest, transcriptSubject } from "./support_chat.ts";

test("a transcript names the course and learner deadline", () => {
  const request = parseSupportRequest({
    learnerId: "learner-17",
    courseName: "Algebra I",
    deadline: "2026-11-01",
    educatorEmail: "educator@example.edu",
    message: "I need help with the final lesson."
  });
  assert.equal(transcriptSubject(request), "Algebra I support transcript for learner-17");
});
