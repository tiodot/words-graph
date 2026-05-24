import Link from "next/link";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">Word Graph</h1>
        <p className="text-gray-400 text-lg mb-8">
          通过多维度关联探索英语单词，让记忆更高效
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/wordbooks"
            className="px-6 py-3 bg-[#4f8cff] text-white rounded-lg hover:bg-[#3a7aee] transition-colors"
          >
            开始使用
          </Link>
          <Link
            href="/settings"
            className="px-6 py-3 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors"
          >
            配置设置
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-3 gap-8 max-w-4xl mx-auto">
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
          <h3 className="font-semibold mb-2">语义关联</h3>
          <p className="text-gray-400 text-sm">
            发现同义词、反义词和上下位词
          </p>
        </div>
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
          <h3 className="font-semibold mb-2">场景关联</h3>
          <p className="text-gray-400 text-sm">
            按地点和场景组织单词
          </p>
        </div>
        <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#2a2a2a]">
          <h3 className="font-semibold mb-2">词根词缀</h3>
          <p className="text-gray-400 text-sm">
            通过构词法理解单词
          </p>
        </div>
      </div>
    </div>
  );
}
