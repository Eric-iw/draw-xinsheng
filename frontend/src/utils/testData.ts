// 测试数据生成器（首页和后台共用，保证两边数据结构一致）
export interface TestStudent {
  name: string;
  id_number: string;
  avatar: string;
  class: string;
}

const SURNAMES = ['王','李','张','刘','陈','杨','黄','赵','吴','周','徐','孙','马','朱','胡','林','郭','何','高','罗'];
const GIVENS = ['伟','芳','娜','敏','静','丽','强','磊','军','洋','勇','艳','杰','娟','涛','明','超','霞','平','刚','桂英','文','辉','鹏','飞'];
const CLASSES = ['信安2301','信安2302','网工2301','网工2302','软工2301','软工2302','数媒2301','计科2301'];

export function generateTestStudents(count = 100): TestStudent[] {
  const list: TestStudent[] = [];
  for (let i = 0; i < count; i++) {
    const name =
      SURNAMES[Math.floor(Math.random() * SURNAMES.length)] +
      GIVENS[Math.floor(Math.random() * GIVENS.length)] +
      (Math.random() > 0.5 ? GIVENS[Math.floor(Math.random() * GIVENS.length)] : '');
    list.push({
      name,
      id_number: `2023${String(500000 + i).padStart(6, '0')}`,
      avatar: '/avatar.png',
      class: CLASSES[Math.floor(Math.random() * CLASSES.length)],
    });
  }
  return list;
}
