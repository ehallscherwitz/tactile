function TopLeft() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-[594px]" data-name="Top Left">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">Janus Brand Refresh v1</p>
      <div className="flex items-center justify-center relative shrink-0 w-full">
        <div className="flex-none rotate-180 w-full">
          <div className="h-0 relative w-full" data-name="Divider">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 594 2">
                <line id="Divider" stroke="var(--stroke-0, black)" strokeWidth="2" x2="594" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TitlePageCount() {
  return (
    <div className="content-stretch flex font-['Inter:Regular',sans-serif] font-normal items-start justify-between leading-[24px] not-italic relative shrink-0 text-[16px] text-black w-full whitespace-nowrap" data-name="Title + Page Count">
      <p className="relative shrink-0">Info</p>
      <p className="relative shrink-0">&nbsp;</p>
    </div>
  );
}

function TopRight() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[12px] items-start min-h-px min-w-px relative" data-name="Top Right">
      <TitlePageCount />
      <div className="flex items-center justify-center relative shrink-0 w-full">
        <div className="flex-none rotate-180 w-full">
          <div className="h-0 relative w-full" data-name="Divider">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1210 2">
                <line id="Divider" stroke="var(--stroke-0, black)" strokeWidth="2" x2="1210" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Top() {
  return (
    <div className="content-stretch flex gap-[20px] items-start relative shrink-0 w-full" data-name="Top">
      <TopLeft />
      <TopRight />
    </div>
  );
}

function Paragraph() {
  return (
    <div className="content-stretch flex flex-[1_0_0] gap-[20px] items-start min-h-px min-w-px relative" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[28px] min-h-px min-w-px not-italic relative text-[24px] text-black">The Tactile typographic system consists of the following fonts: Monument Grotesk Medium, Reckless Neue Light, and Monument Grotesk Mono.</p>
    </div>
  );
}

function Section1() {
  return (
    <div className="content-stretch flex gap-[20px] items-start relative shrink-0 w-[1824px]" data-name="Section">
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] not-italic relative shrink-0 text-[64px] text-black tracking-[-1.92px] w-[594px]">
        <p className="leading-[72px]">Fonts</p>
      </div>
      <Paragraph />
    </div>
  );
}

function Section() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start relative shrink-0" data-name="Section">
      <Top />
      <Section1 />
    </div>
  );
}

function SlideHeader() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-0 px-[48px] py-[32px] top-0" data-name="Slide header">
      <Section />
    </div>
  );
}

function Group() {
  return (
    <div className="-translate-x-1/2 -translate-y-1/2 absolute contents left-[calc(70%-44.5px)] not-italic top-[calc(50%-3.69px)]">
      <div className="absolute flex flex-col font-['Coolvetica:Regular',sans-serif] inset-[11.85%_34.63%_12.54%_34.86%] justify-center leading-[0] text-[333.188px] text-black">
        <p className="leading-[433.145px]">Aa</p>
      </div>
      <div className="absolute flex flex-col font-['Helvetica_Neue:Light',sans-serif] inset-[11.85%_-0.89%_12.54%_70.38%] justify-center leading-[0] text-[333.188px] text-black">
        <p className="leading-[433.145px]">Aa</p>
      </div>
      <p className="absolute font-['Coolvetica:Regular',sans-serif] leading-[1.5] left-[calc(20%+278px)] text-[13.328px] text-black top-[340.28px] tracking-[0.7997px] uppercase whitespace-nowrap">Coolvetica</p>
      <p className="absolute font-['Helvetica_Neue:Regular',sans-serif] leading-[1.5] left-[calc(60%+191.93px)] text-[13.328px] text-black top-[340.28px] tracking-[0.7997px] uppercase w-[189.917px]">Helvetica neue</p>
      <div className="absolute font-['Coolvetica:Regular',sans-serif] font-['Feature_Deck_Trial:Light',sans-serif] leading-[0] left-[calc(20%+278px)] text-[#2a2e2e] text-[0px] text-[39.983px] top-[717.9px] w-[593.075px]">
        <p className="mb-0">
          <span className="leading-[1.4] uppercase">
            abcdefghijklmnop
            <br aria-hidden="true" />
            qrstuvwxyz
          </span>
          <span className="leading-[1.4]">
            <br aria-hidden="true" />
            abcdefghijklmnopqrstuvwxyz
          </span>
        </p>
        <p className="leading-[1.4]">{`1234567890!@#$%^&*()`}</p>
      </div>
      <div className="absolute font-['Feature_Deck_Trial:Light',sans-serif] font-['Helvetica_Neue:Light',sans-serif] leading-[0] left-[calc(60%+191.93px)] text-[#2a2e2e] text-[0px] text-[39.983px] top-[717.9px] w-[593.075px]">
        <p className="mb-0">
          <span className="leading-[1.4] uppercase">
            abcdefghijklmnop
            <br aria-hidden="true" />
            qrstuvwxyz
          </span>
          <span className="leading-[1.4]">
            <br aria-hidden="true" />
            abcdefghijklmnopqrstuvwxyz
          </span>
        </p>
        <p className="leading-[1.4]">{`1234567890!@#$%^&*()`}</p>
      </div>
    </div>
  );
}

export default function Hierarchy() {
  return (
    <div className="bg-white relative size-full" data-name="Hierarchy">
      <SlideHeader />
      <Group />
    </div>
  );
}