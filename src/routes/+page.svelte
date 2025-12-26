<div class="hero">
  <div class="hero-content">
    <h1 class="glow-text">Witness the Circle</h1>
    <p>
      Discover your community's heartbeat with real-time interaction
      visualizers. Experience Bluesky through a dynamic, living ecosystem.
    </p>

    <div class="featured">
      <p class="label">Quick Start</p>
      <div class="links">
        <a href="/suibari.com" class="btn">Explore @suibari.com</a>
      </div>
    </div>
  </div>
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
    color: white;
    text-align: center;
    padding: 0 20px;
  }

  .hero-content {
    max-width: 600px;
    animation: fadeInUp 1s ease-out;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h1 {
    font-size: 4rem;
    font-weight: 900;
    margin-bottom: 1.5rem;
    letter-spacing: -2px;
    line-height: 1;
  }

  .glow-text {
    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 20px rgba(59, 130, 246, 0.3));
  }

  p {
    font-size: 1.25rem;
    color: #94a3b8;
    line-height: 1.6;
    margin-bottom: 2.5rem;
  }

  .featured {
    padding-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #64748b;
    margin-bottom: 1rem;
  }

  .btn {
    display: inline-block;
    padding: 12px 32px;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 999px;
    font-weight: 600;
    transition: all 0.3s;
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
  }

  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(59, 130, 246, 0.6);
    background: #2563eb;
  }
</style>
