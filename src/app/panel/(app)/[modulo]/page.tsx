export default async function PanelPage({
  params,
}: {
  params: Promise<{ modulo: string }>;
}) {
  const { modulo } = await params;
  return (
    <div className="p-4 sm:p-7">
      <h1 className="text-2xl font-bold text-[#1F2421] capitalize">{modulo}</h1>
      <p className="text-[#676B63] mt-1">Módulo en construcción</p>
    </div>
  );
}
