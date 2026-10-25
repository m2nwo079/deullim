import type { Metadata } from "next";
import { PageFooter } from "../../src/components/page-footer";

export const metadata: Metadata = {
  title: "개인정보와 촬영 안내 · 들림",
};

/**
 * What 들림 keeps and what it does not, taken only from docs/auth.md and the current schema.
 * A notice, not a legal policy: no statute is quoted. Not linked from /w or /s, where leaving the
 * page would drop the QR token.
 */
const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "작업자 자세 촬영",
    items: [
      "계정 없이 작업장의 QR로 들어와요. 이름을 묻지 않아요.",
      "촬영 영상과 사진은 휴대폰 밖으로 보내지 않아요. 휴대폰 화면에서 관절 위치만 뽑아 보내요.",
      "서버는 받은 관절 위치로 점수를 다시 계산하고, 관절 위치 원본은 저장하지 않아요.",
      "저장하는 것은 단위작업, 촬영한 프레임 수와 분석 속도, 부위별 자세 요약, 고위험 자세 비율, 점수와 위험 단계, 저장 시각이에요.",
      "촬영 기록에는 어느 QR로 찍었는지 남기지 않아요.",
    ],
  },
  {
    title: "통증 신고",
    items: [
      "저장하는 것은 공정, 아픈 부위, 정도, 신고 시각이에요.",
      "관리자는 신고를 하나씩 보지 않고, 공정별로 한 주씩 묶은 수만 봐요. 신고 시각은 보이지 않아요.",
      "인원이 5명 미만인 공정이 있으면, 같은 상위 묶음의 공정을 모두 합쳐 한 줄로 보여 줘요.",
      "합친 묶음에 공정이 하나뿐이거나 인원 합이 5명 미만이면 그 묶음은 보여 주지 않아요.",
      "인원이 5명 미만인 공정의 신고는 24시간 뒤에 반영돼요.",
    ],
  },
  {
    title: "작업자에 대해 남기지 않는 것",
    items: [
      "이름, 기기 식별자, 쿠키 식별자는 저장하지 않아요. IP 주소는 들림이 저장하는 표에는 남기지 않아요.",
      "한 시간에 보낼 수 있는 신고와 촬영 수는 QR별로 세요. 사람이나 기기별로 세지 않아요.",
      "QR 정보는 들어오자마자 주소창에서 지우고, 열린 화면에만 둬요. 새로 고치면 QR을 다시 찍어야 해요.",
      "호스팅 서비스의 접속 기록은 각 서비스의 정책을 따라요.",
    ],
  },
  {
    title: "시연 촬영",
    items: [
      "안전보건관리자가 콘솔에서 만든 시연 QR은 15분 동안 한 번만 쓸 수 있어요.",
      "시연 촬영 결과는 그 개선안의 효과로 저장돼요. 영상과 관절 위치 원본은 저장하지 않아요.",
    ],
  },
  {
    title: "안전보건관리자와 설비 업체",
    items: [
      "계정은 운영 담당자가 만들어요. 이메일과 비밀번호로 로그인해요.",
      "들림은 표시 이름, 역할, 소속 사업장이나 회사를 저장해요.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <main className="mx-auto flex w-full max-w-80 flex-1 flex-col gap-5 px-2 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-title font-bold">개인정보와 촬영 안내</h1>
          <p className="text-body text-text-secondary">
            들림이 무엇을 저장하고 무엇을 저장하지 않는지 알려 드려요.
          </p>
        </div>
        {SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="text-title-sm font-bold">{section.title}</h2>
            <ul className="flex list-disc flex-col gap-1 pl-3">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <PageFooter />
    </div>
  );
}
