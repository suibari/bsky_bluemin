<script lang="ts">
    import { onMount, onDestroy, tick } from "svelte";
    import { fade } from "svelte/transition";
    import { browser } from "$app/environment";
    import * as d3 from "d3";
    import AvatarNode from "$lib/components/AvatarNode.svelte";

    interface InteractionEvent {
        type: string;
        uri: string;
        author: string;
        authorAvatar?: string;
        authorDisplayName: string;
        text: string;
        image?: string;
        timestamp: string;
        id: string;
        url?: string;
    }

    interface Node extends d3.SimulationNodeDatum {
        did: string;
        avatar?: string;
        displayName: string;
        interactionCount: number;
        sizeFactor: number;
        radius: number;
        hasInteracted: boolean;
    }

    let { nodes = $bindable([]), latestEvents = $bindable(new Map()) } =
        $props<{
            nodes: Node[];
            latestEvents: Map<string, InteractionEvent>;
        }>();

    let simulation: d3.Simulation<Node, undefined> | null = null;
    let decayInterval: any;
    let simulationUpdatePending = false;
    let zoomContainer = $state<HTMLElement | null>(null);
    let transform = $state({ x: 0, y: 0, k: 1 });
    let innerWidth = $state(browser ? window.innerWidth : 1200);
    let previousNodesLength = 0;

    const BASE_RADIUS = 24;

    function initSimulation() {
        if (!browser) return;

        // Stop strict mode simulation if it exists
        if (simulation) simulation.stop();

        simulation = d3
            .forceSimulation<Node>(nodes)
            .velocityDecay(0.6)
            .alphaDecay(0.2)
            .force("charge", d3.forceManyBody<Node>().strength(-100))
            .force(
                "radial",
                d3.forceRadial<Node>(0, 0, 0).strength((d) => {
                    return d.hasInteracted ? 0.3 : 0.8;
                }),
            )
            .force(
                "collide",
                d3
                    .forceCollide<Node>((d) => d.radius + 8)
                    .strength(1)
                    .iterations(4),
            )
            .on("tick", () => {
                nodes = [...nodes];
            });
    }

    function cleanup() {
        if (simulation) {
            simulation.stop();
            simulation = null;
        }
        if (decayInterval) {
            clearInterval(decayInterval);
        }
    }

    $effect(() => {
        if (browser && nodes.length > 0) {
            if (zoomContainer) {
                // Remove existing zoom behavior to prevent stacking listeners if re-initialized
                d3.select(zoomContainer).on(".zoom", null);

                const zoom = d3
                    .zoom<HTMLElement, unknown>()
                    .scaleExtent([0.1, 5])
                    .on("zoom", (event) => {
                        const { x, y, k } = event.transform;
                        transform = { x, y, k };
                    });

                d3.select(zoomContainer).call(zoom);
            }

            // Re-initialize simulation if needed, or update nodes if simulation is already running?
            // For now, let's keep it simple: if simulation is null or nodes changed significantly (length 0 -> >0), init.
            // But nodes array ref changes often due to tick. d3 modifies nodes in place.
            if (!simulation) {
                initSimulation();
                previousNodesLength = nodes.length;
            } else {
                // Critical Fix: Only update simulation if node count has changed (or explicit structural change).
                // DYNAMIC UPDATES (tick) cause `nodes` ref to change, but we MUST NOT re-heat the simulation then.
                // We assume if the first node identity changes, the whole set changed (e.g. mode switch).
                if (
                    nodes.length !== previousNodesLength ||
                    (nodes.length > 0 && nodes[0] !== simulation.nodes()[0])
                ) {
                    simulation.nodes(nodes);
                    const currentAlpha = simulation.alpha();
                    if (currentAlpha < 0.1) {
                        simulation.alpha(0.3).restart();
                    } else {
                        simulation
                            .alpha(Math.min(1.0, currentAlpha + 0.1))
                            .restart();
                    }
                    previousNodesLength = nodes.length;
                }
            }
        } else {
            cleanup();
        }
    });

    // Watch for interaction updates specifically to trigger forces
    $effect(() => {
        // This effect runs when nodes changes.
        // We want to detect if an interaction happened to trigger the specific force update logic.
        // Or we can just expose a method to trigger it?
        // The original code had this logic inside `handleEvent`.
        // Let's rely on the parent updating `nodes` and triggering reactivity here?
        // Actually, standard d3 simulation updates on tick.
        // The specific force update logic was:
        /*
      if (simulation && !simulationUpdatePending) {
        ... update forces ...
        simulation.alpha(0.5).alphaTarget(0.3).restart();
        ...
      }
      */
        // We can make `simulation` derived or watch it.
        // But `handleEvent` in parent modifies node properties.
        // We can export a function `notifyInteraction()`
    });

    export function notifyInteraction() {
        if (simulation && !simulationUpdatePending) {
            simulationUpdatePending = true;
            requestAnimationFrame(() => {
                if (!simulation) {
                    simulationUpdatePending = false;
                    return;
                }
                simulation.force(
                    "radial",
                    d3.forceRadial<Node>(0, 0, 0).strength((d) => {
                        return d.hasInteracted ? 0.3 : 0.8;
                    }),
                );
                simulation.force(
                    "collide",
                    d3
                        .forceCollide<Node>((d) => d.radius + 8)
                        .strength(1)
                        .iterations(8),
                );

                // Similar logic: don't reheat too much
                const currentAlpha = simulation.alpha();
                if (currentAlpha < 0.1) {
                    simulation.alpha(0.3).alphaTarget(0.1).restart();
                } else {
                    simulation
                        .alpha(Math.min(1.0, currentAlpha + 0.1))
                        .alphaTarget(0.1)
                        .restart();
                }
                setTimeout(() => simulation?.alphaTarget(0), 100);
                simulationUpdatePending = false;
            });
        }
    }

    // Re-implement decay interval
    onMount(() => {
        decayInterval = setInterval(() => {
            let changed = false;
            nodes.forEach((node: Node) => {
                if (node.interactionCount > 0) {
                    node.interactionCount = Math.max(
                        0,
                        node.interactionCount - 0.01,
                    );
                    const oldSize = node.sizeFactor;
                    node.sizeFactor = 1 + Math.log10(node.interactionCount + 1);
                    node.radius = BASE_RADIUS * node.sizeFactor;
                    if (Math.abs(oldSize - node.sizeFactor) > 0.01) {
                        changed = true;
                    }
                }
            });
            if (changed && simulation) {
                nodes = [...nodes];
                simulation.force(
                    "collide",
                    d3
                        .forceCollide<Node>((d) => d.radius + 12)
                        .strength(1)
                        .iterations(8),
                );
                simulation.alpha(0.1).alphaTarget(0.1).restart();
                setTimeout(() => simulation?.alphaTarget(0), 100);
            }
        }, 1000);
    });

    onDestroy(() => {
        cleanup();
    });
</script>

<svelte:window bind:innerWidth />

<div class="zoom-container" bind:this={zoomContainer}>
    <div
        class="transform-layer"
        style="transform: translate({transform.x}px, {transform.y}px) scale({transform.k});"
    >
        <div class="nodes-wrapper">
            {#each nodes as node (node.did)}
                <AvatarNode
                    did={node.did}
                    avatar={node.avatar}
                    displayName={node.displayName}
                    event={latestEvents.get(node.did)}
                    x={node.x ?? 0}
                    y={node.y ?? 0}
                    sizeFactor={node.sizeFactor}
                    baseRadius={BASE_RADIUS}
                    hasInteracted={node.hasInteracted}
                />
            {/each}
        </div>
    </div>
</div>

<style>
    .zoom-container {
        width: 100%;
        height: 100%;
        cursor: grab;
    }

    .zoom-container:active {
        cursor: grabbing;
    }

    .transform-layer {
        width: 100%;
        height: 100%;
        transform-origin: 0 0;
    }

    .nodes-wrapper {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 0;
        height: 0;
    }
</style>
