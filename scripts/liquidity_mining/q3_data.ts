interface RewardPeriod {
  rewardPerPeriod: 94017;
  round: number;
  start: number;
  end: number;
  blocks: number;
}
//range: 50,400
export const BlockRounds = {
  rewardForLender: 71223,
  rewardForLM: 38461,
  rewardForBorrower: 56979,//76923,
  blockRanges: [
    //test week
    {
      start: 16384328,
      end: 16386949
    },
    {
      start: 16244257,
      end: 16294657
    },
    {
      start: 16294658,
      end: 16345058
    },
    {
      start: 16345059,
      end: 16395459
    }
  ],
};
