export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="dtop">
        <div className="skl" style={{ width: 220, height: 38 }} />
        <div className="skl only-desktop" style={{ width: 130, height: 44 }} />
      </div>
      <div className="row wrap g20 two-col">
        <div className="card col g12">
          <div className="skl" style={{ height: 26, width: "45%" }} />
          <div className="skl" style={{ height: 64 }} />
          <div className="skl" style={{ height: 64 }} />
          <div className="skl" style={{ height: 64 }} />
        </div>
        <div className="card col g12">
          <div className="skl" style={{ height: 26, width: "35%" }} />
          <div className="skl" style={{ height: 44 }} />
          <div className="skl" style={{ height: 44 }} />
          <div className="skl" style={{ height: 44 }} />
          <div className="skl" style={{ height: 44 }} />
        </div>
      </div>
    </div>
  );
}
